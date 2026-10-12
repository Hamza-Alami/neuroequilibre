'use client';

import { KeyRound, Pencil, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useApp } from '@/components/app/AppProvider';
import { Badge, RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback';
import { Field, Input, Select, Switch } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/lib/hooks';
import { fmt } from '@/lib/time';
import type { Role } from '@/lib/types';
import { getInitials } from '@/lib/utils';
import { createUser, listUsers, resetUserPassword, setUserActive, updateUser, type UserRow } from './actions';

const ROLE_HELP: Record<Role, string> = {
  admin: 'Tous les droits : configuration (boxes, horaires, questionnaires, formulaire KYC), utilisateurs et journal.',
  manager: 'Travail quotidien : clients, fiches KYC, réservations, planning et évaluations. Pas d’accès à la configuration.',
};

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => chars[n % chars.length]).join('');
}

export default function UsersPage() {
  const { profile } = useApp();
  const toast = useToast();
  const users = useAsync(async () => {
    const res = await listUsers();
    if (!res.ok) throw new Error(res.error);
    return res.data;
  }, []);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);

  function act(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setPendingId(id);
    startTransition(async () => {
      const res = await fn();
      setPendingId(null);
      if (res.ok) {
        toast.success(success);
        void users.reload({ silent: true });
      } else toast.error(res.error ?? 'Erreur.');
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Utilisateurs"
        description="Comptes de l’équipe et rôles d’accès."
        actions={
          <Button icon={UserPlus} onClick={() => setCreating(true)}>
            Nouvel utilisateur
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {(['admin', 'manager'] as Role[]).map((r) => (
          <div key={r} className="flex gap-3 rounded-xl border border-line bg-surface px-4 py-3">
            <ShieldCheck className={r === 'admin' ? 'mt-0.5 h-4 w-4 shrink-0 text-gold-700' : 'mt-0.5 h-4 w-4 shrink-0 text-navy'} />
            <div>
              <RoleBadge role={r} />
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{ROLE_HELP[r]}</p>
            </div>
          </div>
        ))}
      </div>

      <Card padded={false} className="overflow-hidden">
        {users.error ? (
          <div className="p-5">
            <Alert tone="error" title="Impossible de charger les utilisateurs">
              {users.error instanceof Error ? users.error.message : 'Erreur.'}
            </Alert>
          </div>
        ) : users.loading ? (
          <PageLoader />
        ) : !users.data?.length ? (
          <EmptyState icon={UsersRound} title="Aucun utilisateur" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-5 py-3">Utilisateur</th>
                  <th className="px-3 py-3">Rôle</th>
                  <th className="px-3 py-3">Dernière connexion</th>
                  <th className="px-3 py-3">Actif</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.data.map((u) => {
                  const isSelf = u.id === profile.id;
                  return (
                    <tr key={u.id} className={u.is_active ? '' : 'bg-surface-muted/60'}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-50 text-[12px] font-semibold text-navy">
                            {getInitials(u.full_name.split(' ')[0] ?? '', u.full_name.split(' ')[1] ?? '')}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-medium text-ink">
                              {u.full_name} {isSelf && <span className="text-[12px] font-normal text-ink-muted">(vous)</span>}
                            </p>
                            <p className="truncate text-[12px] text-ink-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-3 py-3 text-[13px] text-ink-soft">
                        {u.last_sign_in_at ? fmt(u.last_sign_in_at, "d MMM yyyy 'à' HH:mm") : <span className="text-ink-muted">Jamais</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={u.is_active}
                            disabled={isSelf || pendingId === u.id}
                            label={u.is_active ? 'Désactiver' : 'Activer'}
                            onChange={(v) => act(u.id, () => setUserActive(u.id, v), v ? 'Compte réactivé.' : 'Compte désactivé.')}
                          />
                          {!u.is_active && <Badge tone="danger">Désactivé</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(u)}>
                            Modifier
                          </Button>
                          <Button variant="ghost" size="sm" icon={KeyRound} onClick={() => setResetting(u)}>
                            Mot de passe
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateUserModal open={creating} onClose={() => setCreating(false)} onCreated={() => users.reload({ silent: true })} />
      <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={() => users.reload({ silent: true })} />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
    </>
  );
}

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ full_name: '', email: '', password: generatePassword(), role: 'manager' as Role });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await createUser(form);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(`Compte créé pour ${form.full_name}. Communiquez-lui son mot de passe.`);
    onCreated();
    onClose();
    setForm({ full_name: '', email: '', password: generatePassword(), role: 'manager' });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvel utilisateur"
      description="Le compte est actif immédiatement."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving}>
            Créer le compte
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Nom complet" required>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Mot de passe initial" hint="8 caractères minimum. Notez-le pour le transmettre à l’utilisateur.">
          <div className="flex gap-2">
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="font-mono" />
            <Button variant="secondary" onClick={() => setForm({ ...form, password: generatePassword() })}>
              Générer
            </Button>
          </div>
        </Field>
        <Field label="Rôle" hint={ROLE_HELP[form.role]}>
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="manager">Gestionnaire</option>
            <option value="admin">Administrateur</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('manager');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  if (user && user.id !== lastId) {
    setLastId(user.id);
    setName(user.full_name);
    setRole(user.role);
    setError(null);
  }

  async function submit() {
    if (!user) return;
    setSaving(true);
    setError(null);
    const res = await updateUser(user.id, { full_name: name, role });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success('Utilisateur mis à jour.');
    onSaved();
    onClose();
    setLastId(null);
  }

  return (
    <Modal
      open={Boolean(user)}
      onClose={() => {
        onClose();
        setLastId(null);
      }}
      title="Modifier l’utilisateur"
      description={user?.email}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Nom complet">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Rôle" hint={ROLE_HELP[role]}>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="manager">Gestionnaire</option>
            <option value="admin">Administrateur</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState(generatePassword());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!user) return;
    setSaving(true);
    setError(null);
    const res = await resetUserPassword(user.id, password);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(`Mot de passe de ${user.full_name} réinitialisé.`);
    setPassword(generatePassword());
    onClose();
  }

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      size="sm"
      title="Réinitialiser le mot de passe"
      description={user ? `${user.full_name} · ${user.email}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving}>
            Définir ce mot de passe
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Nouveau mot de passe" hint="8 caractères minimum.">
          <div className="flex gap-2">
            <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
            <Button variant="secondary" onClick={() => setPassword(generatePassword())}>
              Générer
            </Button>
          </div>
        </Field>
      </div>
    </Modal>
  );
}
