'use client';

import Link from 'next/link';
import { ArrowUpRight, Clock3, FileSpreadsheet, RotateCw } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { EmptyState, LoadingState } from '@/components/ui/feedback-state';
import { Notice } from '@/components/ui/notice';
import { PageHeading } from '@/components/ui/page-heading';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ImportJob } from '../types';

export interface ImportHistoryViewProps {
  imports: ImportJob[];
  error: string;
  loading: boolean;
  inProgressCount: number;
  refresh: () => void;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function statusKind(status: ImportJob['status']): 'current' | 'running' | 'warning' {
  if (status === 'completed') return 'current';
  if (status === 'queued' || status === 'processing') return 'running';
  return 'warning';
}

export function ImportHistoryView({ imports, error, loading, inProgressCount, refresh }: ImportHistoryViewProps) {
  return <div className="page-stack">
    <PageHeading eyebrow="PRICE OPERATIONS" title="Import history" description="Track feed processing, row outcomes, and validation issues." action={<Link className="button button-primary" href="/pricing/upload"><span className="button-plus">+</span> New upload</Link>} />
    <section className="summary-strip import-summary-strip"><div className="summary-item"><span className="summary-icon summary-icon-green"><FileSpreadsheet size={17} /></span><div><small>RECENT JOBS</small><strong>{loading ? '—' : imports.length}</strong></div></div><div className="summary-divider" /><div className="summary-item"><span className="summary-icon summary-icon-orange"><Clock3 size={17} /></span><div><small>IN PROGRESS</small><strong>{inProgressCount}</strong></div></div><div className="summary-spacer" /><span className="sync-status"><span /> AUTO-REFRESH 4 SEC</span></section>
    <section className="data-panel"><div className="data-panel-head"><div><h2>Recent imports</h2><p>Latest 100 jobs for your authorized stores.</p></div><IconButton label="Refresh import history" onClick={refresh}><RotateCw size={16} /></IconButton></div>
      {error && <Notice variant="error">{error}</Notice>}
      <div className="table-scroll"><table className="pricing-table imports-table"><thead><tr><th>FILE</th><th>STORE</th><th>CREATED</th><th>ROWS</th><th>OUTCOME</th><th>STATUS</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>
        {loading && <tr><td colSpan={7}><LoadingState>Loading import jobs…</LoadingState></td></tr>}
        {!loading && !imports.length && <tr><td colSpan={7}><EmptyState icon={<FileSpreadsheet size={20} />} title="No imports yet" description="Upload a store price feed to start a job." action={<Link href="/pricing/upload" className="text-link">Upload a CSV</Link>} /></td></tr>}
        {!loading && imports.map((job) => <tr key={job.id}><td><span className="filename-cell"><FileSpreadsheet size={17} />{job.filename}</span><small className="cell-subtitle">{job.id.slice(0, 8)}</small></td><td><span className="sku-code">{job.storeId}</span></td><td>{formatTime(job.createdAt)}</td><td>{job.totalRecords.toLocaleString()}</td><td><span className="outcome-count"><strong>{job.successfulRecords}</strong> ok <i>/</i> <strong className="text-error">{job.failedRecords}</strong> failed <i>/</i> <strong className="text-muted">{job.skippedRecords}</strong> skipped</span></td><td><StatusBadge kind={statusKind(job.status)}>{job.status.replaceAll('_', ' ')}</StatusBadge></td><td><Link href={`/pricing/imports/${job.id}`} className="icon-link" aria-label={`View import ${job.filename}`}><ArrowUpRight size={16} /></Link></td></tr>)}
      </tbody></table></div>
    </section>
  </div>;
}
