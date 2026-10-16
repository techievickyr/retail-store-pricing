'use client';

import { CalendarClock, History, RotateCcw, Save, Trash2 } from 'lucide-react';
import { BackLink } from '@/components/ui/back-link';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LoadingState } from '@/components/ui/feedback-state';
import { Notice } from '@/components/ui/notice';
import { PageHeading } from '@/components/ui/page-heading';
import { StatusBadge } from '@/components/ui/status-badge';
import type { FormEvent } from 'react';
import type { AuditEvent, PriceConfirmation, PriceRecord } from '../types';

export interface PriceDetailViewProps {
  price: PriceRecord | null;
  history: AuditEvent[];
  amount: string;
  setAmount: (amount: string) => void;
  effectiveDate: string;
  setEffectiveDate: (date: string) => void;
  error: string;
  notice: string;
  saving: boolean;
  admin: boolean;
  canManage: boolean;
  undoing: number | null;
  confirmation: PriceConfirmation | null;
  confirming: boolean;
  scheduled: boolean;
  save: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  requestCancel: () => void;
  requestDeleteHistory: () => void;
  requestCompensation: (auditEventId: number) => void;
  confirmAction: () => Promise<void>;
  dismissConfirmation: () => void;
}

export function PriceDetailView(props: PriceDetailViewProps) {
  const {
    price, history, amount, setAmount, effectiveDate, setEffectiveDate, error, notice, saving, admin, canManage,
    undoing, confirmation, confirming, scheduled, save, requestCancel, requestDeleteHistory,
    requestCompensation, confirmAction, dismissConfirmation,
  } = props;

  if (!price) {
    return <div className="page-stack narrow-page"><BackLink href="/pricing">Back to price book</BackLink>{error ? <Notice variant="error">{error}</Notice> : <LoadingState>Loading price record…</LoadingState>}</div>;
  }

  const confirmationContent = confirmation?.action === 'cancel-price'
    ? { title: 'Cancel scheduled price?', description: 'This future price will be removed from the schedule. The action will be recorded in price history.', confirmLabel: 'Cancel scheduled price', destructive: true }
    : confirmation?.action === 'delete-history'
      ? { title: 'Delete price history?', description: 'Audit events for this record will be deleted. This administrative action is recorded separately.', confirmLabel: 'Delete history', destructive: true }
      : confirmation?.action === 'compensate'
        ? { title: 'Create a compensating change?', description: 'The previous price will be scheduled as a new record effective tomorrow in the store timezone. Existing history remains unchanged.', confirmLabel: 'Schedule price', destructive: false }
        : null;

  return <div className="page-stack narrow-page">
    <BackLink href="/pricing">Back to price book</BackLink>
    <PageHeading eyebrow="PRICE RECORD" title={price.productName} description={`${price.sku} · ${price.storeId}`} action={<StatusBadge kind={scheduled ? 'scheduled' : 'current'}>{scheduled ? 'Scheduled' : 'Current'}</StatusBadge>} />
    {error && <Notice variant="error">{error}</Notice>}
    {notice && <Notice variant="success">{notice}</Notice>}
    <section className="record-hero"><div><small>PRICE</small><strong>{new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency }).format(Number(price.price))}</strong></div><div><small>VALID FROM</small><strong>{price.effectiveDate.slice(0, 10)}</strong></div><div><small>VALID THROUGH</small><strong>{price.effectiveThrough ?? 'No end date'}</strong></div><div><small>CURRENCY</small><strong>{price.currency}</strong></div></section>
    {scheduled && canManage && <section className="filter-panel"><div className="section-topline"><div><h2>Edit scheduled price</h2><p>Only future prices can be changed. A new date is checked against the price timeline.</p></div><span className="step-badge"><CalendarClock size={16} /></span></div><form className="edit-form" onSubmit={save}><label className="field"><span>Price ({price.currency})</span><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label className="field"><span>Effective date</span><input type="date" required value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /></label><div className="edit-actions"><Button type="button" variant="danger-quiet" icon={<Trash2 size={15} />} onClick={requestCancel}>Cancel scheduled price</Button><Button type="submit" variant="primary" disabled={saving} icon={<Save size={15} />}>{saving ? 'Saving…' : 'Save changes'}</Button></div></form></section>}
    <section className="data-panel"><div className="data-panel-head"><div className="history-heading"><span className="history-icon"><History size={17} /></span><div><h2>Price history</h2><p>Recorded changes and import source.</p></div></div>{admin && <Button type="button" variant="danger-quiet" className="text-button text-danger" icon={<Trash2 size={14} />} onClick={requestDeleteHistory}>Delete history</Button>}</div><div className="timeline">{history.length === 0 && <div className="timeline-empty">No audit events available for this record.</div>}{history.map((event) => <div className="timeline-event" key={event.id}><span className="timeline-marker" /><div className="timeline-body"><div className="timeline-top"><strong>{event.reason}</strong><time>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.changedAt))}</time></div><p>{event.oldPrice ? `${event.oldPrice} → ` : ''}{event.newPrice ?? 'Cancelled'} {price.currency}<span> · {event.changedBy} · {event.source}</span></p>{canManage && event.oldPrice && event.source !== 'undo' && event.source !== 'timeline' && <Button type="button" variant="quiet" className="text-button timeline-undo" disabled={undoing === event.id} icon={<RotateCcw size={13} />} onClick={() => requestCompensation(event.id)}>{undoing === event.id ? 'Scheduling…' : 'Create compensating change'}</Button>}</div></div>)}</div></section>
    <ConfirmDialog
      open={confirmationContent !== null}
      title={confirmationContent?.title ?? ''}
      description={confirmationContent?.description ?? ''}
      confirmLabel={confirmationContent?.confirmLabel ?? ''}
      destructive={confirmationContent?.destructive}
      busy={confirming}
      onCancel={dismissConfirmation}
      onConfirm={confirmAction}
    />
  </div>;
}
