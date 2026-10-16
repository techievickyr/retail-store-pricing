'use client';

import { useSyncExternalStore } from 'react';

export interface MockIdentityOption {
  id: string;
  label: string;
  role: string;
  scope: string;
}

export const mockIdentityOptions: MockIdentityOption[] = [
  { id: 'manager-store001', label: 'Asha Patel', role: 'Store manager', scope: 'Mumbai Central' },
  { id: 'manager-store100', label: 'Oliver Reed', role: 'Store manager', scope: 'London Bridge' },
  { id: 'store-admin', label: 'Retail Admin', role: 'Store admin', scope: 'All stores' },
  { id: 'pricing-viewer', label: 'Pricing Viewer', role: 'Read only', scope: 'All stores' },
];

function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot(): string {
  return window.localStorage.getItem('pricing-mock-user') ?? mockIdentityOptions[0]!.id;
}

function getServerSnapshot(): string {
  return mockIdentityOptions[0]!.id;
}

export function useMockIdentity() {
  const selectedId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user = mockIdentityOptions.find((option) => option.id === selectedId) ?? mockIdentityOptions[0]!;

  function selectUser(id: string): void {
    if (!mockIdentityOptions.some((option) => option.id === id)) return;
    window.localStorage.setItem('pricing-mock-user', id);
    window.location.reload();
  }

  return { user, selectUser };
}
