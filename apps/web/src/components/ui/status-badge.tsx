type StatusKind = 'current' | 'scheduled' | 'running' | 'warning' | 'error' | 'muted';

export interface StatusBadgeProps {
  kind: StatusKind;
  children: string;
}

const statusClasses: Record<StatusKind, string> = {
  current: 'status-current',
  scheduled: 'status-scheduled',
  running: 'status-running',
  warning: 'status-warning',
  error: 'status-error',
  muted: 'status-muted',
};

export function StatusBadge({ kind, children }: StatusBadgeProps) {
  return <span className={`status-pill ${statusClasses[kind]}`}><span />{children}</span>;
}
