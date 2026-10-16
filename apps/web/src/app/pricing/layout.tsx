import { Suspense } from 'react';
import AppShell from '@/components/app-shell';

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="shell-loading">Loading pricing workspace…</div>}><AppShell>{children}</AppShell></Suspense>;
}
