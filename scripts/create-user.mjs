// Crée un compte (admin ou gestionnaire) dans Supabase Auth.
// Usage : npm run create-user -- <email> <mot-de-passe> <admin|manager> "<Nom complet>"
import { createClient } from '@supabase/supabase-js';

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

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role },
  user_metadata: { full_name: fullName || email.split('@')[0] },
});

if (error) {
  console.error(`Échec : ${error.message}`);
  process.exit(1);
}
console.log(`Compte créé : ${data.user.email} (${role === 'admin' ? 'Administrateur' : 'Gestionnaire'})`);
