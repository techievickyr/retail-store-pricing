import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';

type NoticeVariant = 'error' | 'success';

export interface NoticeProps {
  variant: NoticeVariant;
  children: ReactNode;
}

export function Notice({ variant, children }: NoticeProps) {
  const Icon = variant === 'error' ? CircleAlert : CircleCheck;
  return <div className={variant === 'error' ? 'inline-alert' : 'success-inline'} role={variant === 'error' ? 'alert' : 'status'}>
    <Icon size={16} />{children}
  </div>;
}
