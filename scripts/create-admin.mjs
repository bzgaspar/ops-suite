// Creates the first admin account.
//   npm run create-admin -- <username> <password> "<Full Name>"
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const [username, password, fullName = 'Administrator'] = process.argv.slice(2);
if (!username || !password) {
  console.error('Usage: npm run create-admin -- <username> <password> "<Full Name>"');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const uname = username.trim().toLowerCase();
const email = uname.includes('@') ? uname : `${uname}@users.ops-suite.local`;

const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (error) { console.error('Auth error:', error.message); process.exit(1); }

const { error: pErr } = await supabase.from('profiles').insert({
  id: data.user.id, username: uname, full_name: fullName, role: 'admin', system: null, active: true,
});
if (pErr) {
  await supabase.auth.admin.deleteUser(data.user.id);
  console.error('Profile error:', pErr.message, '\nDid you run supabase/schema.sql first?');
  process.exit(1);
}
console.log(`Admin "${uname}" created. Sign in with that username and password.`);
