import type { ReactNode } from 'react';

export interface LoadingStateProps {
  children: ReactNode;
}

export function LoadingState({ children }: LoadingStateProps) {
  return <div className="table-message" role="status"><span className="spinner" />{children}</div>;
}

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return <div className="empty-state">
    <span className="empty-mark">{icon}</span>
    <strong>{title}</strong>
    <span>{description}</span>
    {action}
  </div>;
}
