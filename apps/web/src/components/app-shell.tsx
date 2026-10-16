'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Boxes, CircleUserRound, ClipboardList, Store, Upload, ChevronDown } from 'lucide-react';
import { useMockIdentity, mockIdentityOptions } from '@/hooks/use-mock-identity';

const links = [
  { href: '/pricing', label: 'Price book', icon: Boxes },
  { href: '/pricing/upload', label: 'Upload feed', icon: Upload },
  { href: '/pricing/imports', label: 'Import history', icon: ClipboardList },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user: mockUser, selectUser } = useMockIdentity();

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/pricing" className="brand-lockup" aria-label="Retail pricing home">
          <span className="brand-mark"><Store size={20} strokeWidth={2.2} /></span>
          <span><strong>Tiger</strong><small>RETAIL OPERATIONS</small></span>
        </Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === '/pricing' && pathname.startsWith('/pricing/') && !pathname.includes('/imports'));
            return <Link key={href} href={href} className={`nav-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{active && <span className="nav-indicator" />}
            </Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="store-context"><span className="context-dot" /><div><small>ACTIVE SCOPE</small><strong>{mockUser.scope}</strong></div></div>
          <a className="sidebar-docs" href="http://localhost:4000/health" target="_blank" rel="noreferrer">Service status <ArrowUpRight size={14} /></a>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Pricing</span><span className="breadcrumb-slash">/</span><strong>{links.find((link) => link.href === pathname)?.label ?? (pathname.includes('/imports/') ? 'Import detail' : pathname === '/pricing/upload' ? 'Upload feed' : pathname.includes('/pricing/') ? 'Price detail' : 'Price book')}</strong></div>
          <label className="user-switcher">
            <CircleUserRound size={18} />
            <span className="user-copy"><strong>{mockUser.label}</strong><small>{mockUser.role}</small></span>
            <ChevronDown size={15} />
            <select aria-label="Switch mock user" value={mockUser.id} onChange={(event) => selectUser(event.target.value)}>
              {mockIdentityOptions.map((user) => <option key={user.id} value={user.id}>{user.label} · {user.role}</option>)}
            </select>
          </label>
        </header>
        <main className="main-content">{children}</main>
        <footer className="app-footer"><span>TIGER PRICING</span><span>Store data is scoped by your access</span></footer>
      </div>
    </div>
  );
}
