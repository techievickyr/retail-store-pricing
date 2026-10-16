'use client';

import { Download, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { BackLink } from '@/components/ui/back-link';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/feedback-state';
import { Notice } from '@/components/ui/notice';
import { PageHeading } from '@/components/ui/page-heading';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ImportJob, ImportRowResult } from '../types';

export interface ImportDetailViewProps {
  job: ImportJob | null;
  canManage: boolean;
  rows: ImportRowResult[];
  error: string;
  retrying: boolean;
  retryMessage: string;
  retryFailed: () => Promise<void>;
  downloadReport: () => Promise<void>;
}

function statusKind(status: ImportJob['status']): 'current' | 'running' | 'warning' {
  if (status === 'completed') return 'current';
  if (status === 'queued' || status === 'processing') return 'running';
  return 'warning';
}

export function ImportDetailView({ job, rows, canManage, error, retrying, retryMessage, retryFailed, downloadReport }: ImportDetailViewProps) {
  return <div className="page-stack narrow-page">
    <BackLink href="/pricing/imports">Back to import history</BackLink>
    <PageHeading eyebrow="IMPORT JOB" title="Import results" description="Detailed row outcomes and validation feedback." action={job ? <StatusBadge kind={statusKind(job.status)}>{job.status.replaceAll('_', ' ')}</StatusBadge> : undefined} />
    {error && <Notice variant="error">{error}</Notice>}
    {!job && !error && <LoadingState>Loading import job…</LoadingState>}
    {job && <>
      {job.terminalError && <Notice variant="error">{job.terminalError}</Notice>}
      <section className="filter-panel job-overview"><div className="job-file"><span className="file-square"><FileSpreadsheet size={20} /></span><div><strong>{job.filename}</strong><small>{job.storeId} · Submitted {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(job.createdAt))}</small></div></div>
        <div className="job-counts"><div><strong>{job.totalRecords}</strong><span>Total</span></div><div className="count-ok"><strong>{job.successfulRecords}</strong><span>Successful</span></div><div className="count-failed"><strong>{job.failedRecords}</strong><span>Failed</span></div><div><strong>{job.skippedRecords}</strong><span>Skipped</span></div></div>
        <div className="job-actions"><Button type="button" variant="quiet" icon={<Download size={15} />} onClick={() => void downloadReport()}>Download results CSV</Button><Button type="button" variant="dark" disabled={!canManage || !job.failedRecords || retrying || Boolean(job.terminalError) || job.status === 'queued' || job.status === 'processing'} icon={<RotateCcw size={15} />} onClick={() => void retryFailed()}>{retrying ? 'Queueing…' : 'Retry failed rows'}</Button></div>
      </section>
      {retryMessage && <Notice variant="success">{retryMessage}</Notice>}
      <section className="data-panel"><div className="data-panel-head"><div><h2>Row results</h2><p>Failures and skipped duplicates include source row and reason.</p></div></div><div className="table-scroll"><table className="pricing-table"><thead><tr><th>ROW</th><th>STATUS</th><th>FIELD</th><th>VALUE</th><th>DETAIL</th></tr></thead><tbody>
        {rows.length === 0 && <tr><td colSpan={5}><EmptyState icon={<FileSpreadsheet size={20} />} title={job.status === 'queued' || job.status === 'processing' ? 'Processing import' : 'No row issues'} description={job.status === 'queued' || job.status === 'processing' ? 'Waiting for the worker to process rows…' : 'No row-level issues were reported.'} /></td></tr>}
        {rows.map((row) => <tr key={row.rowNumber}><td className="mono-cell">{row.rowNumber}</td><td><StatusBadge kind={row.status === 'success' ? 'current' : row.status === 'skipped' ? 'muted' : 'error'}>{row.status}</StatusBadge></td><td>{row.field ?? '—'}</td><td className="mono-cell">{row.rejectedValue ?? '—'}</td><td className={row.status === 'failed' ? 'text-error' : ''}>{row.reason}</td></tr>)}
      </tbody></table></div></section>
    </>}
  </div>;
}
