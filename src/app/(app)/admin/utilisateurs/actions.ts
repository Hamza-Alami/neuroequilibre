'use server';

import { createAdminSupabase } from '@/lib/supabase/admin';
import { getCurrentProfile } from '@/lib/supabase/server';
import type { Profile, Role } from '@/lib/types';

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export interface UserRow extends Profile {
  last_sign_in_at: string | null;
}

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active || profile.role !== 'admin') {
    throw new Error('Action réservée à l’administrateur.');
  }
  return profile;
}

async function run<T>(fn: (actor: Profile) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const actor = await requireAdmin();
    return { ok: true, data: await fn(actor) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inattendue.' };
  }
}

async function log(actor: Profile, action: string, target: { id: string; label: string }, details?: Record<string, unknown>) {
  await createAdminSupabase().from('audit_log').insert({
    actor_id: actor.id,
    actor_name: actor.full_name,
    action,
    entity: 'users',
    entity_id: target.id,
    label: target.label,
    details: details ?? null,
  });
}

async function getProfile(id: string): Promise<Profile> {
  const { data, error } = await createAdminSupabase()
    .from('profiles')
    .select('id, full_name, email, role, is_active, created_at')
    .eq('id', id)
    .single();
  if (error || !data) throw new Error('Utilisateur introuvable.');
  return data as Profile;
}

async function activeAdminCount() {
  const { count } = await createAdminSupabase()
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('is_active', true);
  return count ?? 0;
}

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Adresse email invalide.');
}

function validatePassword(password: string) {
  if (password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
}

export async function listUsers(): Promise<ActionResult<UserRow[]>> {
  return run(async () => {
    const admin = createAdminSupabase();
    const [{ data: profiles, error }, { data: auth }] = await Promise.all([
      admin.from('profiles').select('id, full_name, email, role, is_active, created_at').order('created_at'),
      admin.auth.admin.listUsers({ perPage: 200 }),
    ]);
    if (error) throw new Error(error.message);
    const lastSignIn = new Map((auth?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));
    return (profiles as Profile[]).map((p) => ({ ...p, last_sign_in_at: lastSignIn.get(p.id) ?? null }));
  });
}

export async function createUser(input: {
  full_name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<ActionResult> {
  return run(async (actor) => {
    const full_name = input.full_name.trim();
    const email = input.email.trim().toLowerCase();
    if (!full_name) throw new Error('Le nom est requis.');
    validateEmail(email);
    validatePassword(input.password);
    const role: Role = input.role === 'admin' ? 'admin' : 'manager';

    const { data, error } = await createAdminSupabase().auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name },
      app_metadata: { role },
    });
    if (error) {
      if (error.message.toLowerCase().includes('already')) throw new Error('Un compte existe déjà avec cet email.');
      throw new Error(error.message);
    }
    await log(actor, 'create', { id: data.user.id, label: `${full_name} (${role === 'admin' ? 'Administrateur' : 'Gestionnaire'})` });
    return null;
  });
}

export async function updateUser(id: string, patch: { full_name?: string; role?: Role }): Promise<ActionResult> {
  return run(async (actor) => {
    const target = await getProfile(id);
    const admin = createAdminSupabase();
    const update: Partial<Profile> = {};

    if (patch.full_name !== undefined) {
      const name = patch.full_name.trim();
      if (!name) throw new Error('Le nom est requis.');
      update.full_name = name;
    }
    if (patch.role && patch.role !== target.role) {
      if (target.role === 'admin' && target.is_active && (await activeAdminCount()) <= 1) {
        throw new Error('Impossible : il doit rester au moins un administrateur actif.');
      }
      update.role = patch.role;
      const { error } = await admin.auth.admin.updateUserById(id, { app_metadata: { role: patch.role } });
      if (error) throw new Error(error.message);
    }
    if (!Object.keys(update).length) return null;

    const { error } = await admin.from('profiles').update(update).eq('id', id);
    if (error) throw new Error(error.message);
    if (update.full_name) {
      await admin.auth.admin.updateUserById(id, { user_metadata: { full_name: update.full_name } });
    }
    await log(actor, update.role ? 'role' : 'update', { id, label: update.full_name ?? target.full_name }, update.role ? { role: update.role } : undefined);
    return null;
  });
}

export async function setUserActive(id: string, active: boolean): Promise<ActionResult> {
  return run(async (actor) => {
    if (id === actor.id && !active) throw new Error('Vous ne pouvez pas désactiver votre propre compte.');
    const target = await getProfile(id);
    if (!active && target.role === 'admin' && target.is_active && (await activeAdminCount()) <= 1) {
      throw new Error('Impossible : il doit rester au moins un administrateur actif.');
    }
    const admin = createAdminSupabase();
    const { error: banError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: active ? 'none' : '876000h',
    });
    if (banError) throw new Error(banError.message);
    const { error } = await admin.from('profiles').update({ is_active: active }).eq('id', id);
    if (error) throw new Error(error.message);
    await log(actor, active ? 'activate' : 'deactivate', { id, label: target.full_name });
    return null;
  });
}

export async function resetUserPassword(id: string, password: string): Promise<ActionResult> {
  return run(async (actor) => {
    validatePassword(password);
    const target = await getProfile(id);
    const { error } = await createAdminSupabase().auth.admin.updateUserById(id, { password });
    if (error) throw new Error(error.message);
    await log(actor, 'password', { id, label: target.full_name });
    return null;
  });
}
