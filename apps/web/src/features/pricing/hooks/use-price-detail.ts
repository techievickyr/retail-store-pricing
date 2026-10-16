'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pricingApi } from '../pricing-api';
import type { AuditEvent, PriceConfirmation, PriceRecord } from '../types';

export function usePriceDetail(recordId: string) {
  const router = useRouter();
  const [price, setPrice] = useState<PriceRecord | null>(null);
  const [history, setHistory] = useState<AuditEvent[]>([]);
  const [amount, setAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [undoing, setUndoing] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<PriceConfirmation | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      pricingApi.getPrice(recordId, controller.signal),
      pricingApi.getPriceHistory(recordId, controller.signal),
      pricingApi.getCurrentUser(controller.signal),
    ]).then(([priceResponse, historyResponse, userResponse]) => {
      if (controller.signal.aborted) return;
      setPrice(priceResponse.price);
      setAmount(priceResponse.price.price);
      setEffectiveDate(priceResponse.price.effectiveDate.slice(0, 10));
      setHistory(historyResponse.events);
      setAdmin(userResponse.user.role === 'STORE_ADMIN');
      setCanManage(['STORE_ADMIN', 'STORE_MANAGER'].includes(userResponse.user.role));
      setError('');
    }).catch((cause: Error) => {
      if (!controller.signal.aborted) setError(cause.message);
    });
    return () => controller.abort();
  }, [recordId, refreshVersion]);

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!price) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await pricingApi.updateScheduledPrice(price.id, { price: amount, effectiveDate, version: price.version });
      setNotice('Scheduled price updated. Previous and later prices were preserved in the timeline.');
      setRefreshVersion((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save price');
    } finally {
      setSaving(false);
    }
  }

  function requestCancel(): void {
    setConfirmation({ action: 'cancel-price' });
  }

  function requestDeleteHistory(): void {
    setConfirmation({ action: 'delete-history' });
  }

  function requestCompensation(auditEventId: number): void {
    setConfirmation({ action: 'compensate', auditEventId });
  }

  async function confirmAction(): Promise<void> {
    if (!price || !confirmation) return;
    setConfirming(true); setError('');
    try {
      if (confirmation.action === 'cancel-price') {
        await pricingApi.cancelScheduledPrice(price.id);
        router.push('/pricing');
        return;
      }
      if (confirmation.action === 'delete-history') {
        await pricingApi.deletePriceHistory(price.id);
        setHistory([]);
        setNotice('Audit history deleted by store admin.');
      } else {
        setUndoing(confirmation.auditEventId);
        const response = await pricingApi.createCompensatingChange(price.id, confirmation.auditEventId);
        setNotice(`Compensating price scheduled for ${response.effectiveDate}.`);
        setRefreshVersion((current) => current + 1);
      }
      setConfirmation(null);
    } catch (cause) {
      const fallback = confirmation.action === 'cancel-price'
        ? 'Could not cancel scheduled price'
        : confirmation.action === 'delete-history' ? 'Could not delete history' : 'Could not schedule a compensating change';
      setError(cause instanceof Error ? cause.message : fallback);
    } finally {
      setConfirming(false);
      setUndoing(null);
    }
  }

  function dismissConfirmation(): void {
    if (!confirming) setConfirmation(null);
  }

  const scheduled = price?.isScheduled ?? false;
  return {
    price,
    history,
    amount,
    setAmount,
    effectiveDate,
    setEffectiveDate,
    error,
    notice,
    saving,
    admin,
    canManage,
    undoing,
    confirmation,
    confirming,
    scheduled,
    save,
    requestCancel,
    requestDeleteHistory,
    requestCompensation,
    confirmAction,
    dismissConfirmation,
  };
}
