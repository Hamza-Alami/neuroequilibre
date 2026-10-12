// Crée un compte (admin ou gestionnaire) dans Supabase Auth.
// Usage : npm run create-user -- <email> <mot-de-passe> <admin|manager> "<Nom complet>"
const [email, password, role = 'admin', fullName = ''] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env.local');
  process.exit(1);
}
if (!email || !password || !['admin', 'manager'].includes(role)) {
  console.error('Usage : npm run create-user -- <email> <mot-de-passe> <admin|manager> "<Nom complet>"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Le mot de passe doit contenir au moins 8 caractères.');
  process.exit(1);
}

// Appel HTTP direct à l'API Auth : supabase-js exige un WebSocket natif (Node 22+).
const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { full_name: fullName || email.split('@')[0] },
  }),
});
const data = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error(`Échec : ${data.msg ?? data.message ?? data.error_description ?? res.statusText}`);
  process.exit(1);
}

// Supabase Auth écrit app_metadata après l'insertion : le trigger du profil ne voit pas toujours le rôle.
const profile = await fetch(`${url.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${data.id}`, {
  method: 'PATCH',
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ role }),
});
if (!profile.ok) {
  console.error(`Compte créé mais rôle non appliqué : ${await profile.text()}`);
  process.exit(1);
}
console.log(`Compte créé : ${data.email} (${role === 'admin' ? 'Administrateur' : 'Gestionnaire'})`);
