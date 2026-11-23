'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LogIn } from 'lucide-react';
import { notify } from '@/lib/notify';
import { clearLoadCache } from '@/lib/hooks';
import { homeFor } from '@/lib/access';
import { supabaseBrowser } from '@/lib/supabase/client';
import { usernameToEmail } from '@/lib/format';
import { Button, Input } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!username.trim() || !password) return notify.error('Enter your username and password');
    setLoading(true);
    const supabase = supabaseBrowser();
    let ok = false;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
      if (error || !data.user) {
        const badCreds = error?.code === 'invalid_credentials' || error?.status === 400;
        return notify.error(badCreds ? 'Wrong username or password' : error ?? 'Could not sign in');
      }
      const { data: profile, error: pErr } = await supabase.from('profiles').select('role, system, active').eq('id', data.user.id).maybeSingle();
      if (pErr || !profile || !profile.active) {
        await supabase.auth.signOut();
        return notify.error(pErr ?? (profile ? 'This account is disabled. Contact the admin.' : 'No profile for this account. Contact the admin.'));
      }
      clearLoadCache();
      ok = true;
      router.replace(homeFor(profile));
      router.refresh();
    } catch (err) {
      notify.error(err, 'Could not sign in. Please try again.');
    } finally {
      if (!ok) setLoading(false); // keep the spinner while redirecting
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="text-center mb-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-primary-600 flex items-center justify-center mb-3">
            <Lock className="text-white" size={22} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">OpsSuite</h1>
          <p className="text-sm text-slate-500">Sign in to your system</p>
        </div>
        <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        <Button type="submit" loading={loading} icon={<LogIn size={16} />} className="w-full" size="lg">Sign in</Button>
        <p className="text-xs text-center text-slate-400">Accounts are created by the administrator.</p>
      </form>
    </div>
  );
}
