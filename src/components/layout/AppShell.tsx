'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, createContext, useContext } from 'react';
import { LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { clearLoadCache } from '@/lib/hooks';
import type { Profile } from '@/lib/types';
import { AREAS, NAV, canSee, type Area } from './nav';

const ProfileCtx = createContext<Profile | null>(null);
export const useProfile = () => useContext(ProfileCtx)!;

export default function AppShell({ area, profile, children }: { area: Area; profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const meta = AREAS[area];
  const AreaIcon = meta.icon;
  const items = NAV[area].filter((i) => canSee(i, profile.role));
  const isAdmin = profile.role === 'admin';

  const logout = async () => {
    await supabaseBrowser().auth.signOut();
    clearLoadCache();
    router.replace('/login');
    router.refresh();
  };

  const isActive = (href: string) => (href === `/${area}` ? pathname === href : pathname.startsWith(href));

  return (
    <ProfileCtx.Provider value={profile}>
      <div className="flex h-screen overflow-hidden">
        {open && <button aria-label="Close menu" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

        <aside className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-slate-900 transition-transform lg:relative lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="relative h-16 px-4 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
            <button
              className={`flex items-center gap-2 min-w-0 text-left ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => isAdmin && setSwitcher((s) => !s)}
            >
              <div className={`w-8 h-8 ${meta.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <AreaIcon size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{meta.name}</p>
                <p className="text-slate-400 text-[11px]">OpsSuite{isAdmin ? ' · switch system' : ''}</p>
              </div>
              {isAdmin && <ChevronDown size={14} className="text-slate-400" />}
            </button>
            <button className="lg:hidden p-2 text-slate-400" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>

            {isAdmin && switcher && (
              <div className="absolute left-3 right-3 top-14 z-10 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1">
                {(Object.keys(AREAS) as Area[]).map((a) => {
                  const A = AREAS[a];
                  const Icon = A.icon;
                  return (
                    <Link key={a} href={`/${a}`} onClick={() => { setSwitcher(false); setOpen(false); }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm ${a === area ? 'text-white bg-slate-700' : 'text-slate-300 hover:bg-slate-700'}`}>
                      <span className={`w-6 h-6 rounded ${A.color} flex items-center justify-center`}><Icon size={14} className="text-white" /></span>
                      {A.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
            {items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive(href) ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                <Icon size={18} /> {label}
              </Link>
            ))}
          </nav>

          <div className="p-3 border-t border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-2 px-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-slate-700 text-white text-sm font-semibold flex items-center justify-center">
                {profile.full_name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm truncate">{profile.full_name}</p>
                <p className="text-slate-400 text-xs capitalize">{profile.role}</p>
              </div>
            </div>
            <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="lg:hidden h-14 flex items-center gap-3 px-4 bg-white border-b border-slate-200 flex-shrink-0">
            <button onClick={() => setOpen(true)} className="p-2 -ml-2 text-slate-600" aria-label="Open menu"><Menu size={20} /></button>
            <span className="font-semibold text-slate-900 truncate">{meta.name}</span>
          </header>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ProfileCtx.Provider>
  );
}
