'use client';

import { useEffect, useState } from 'react';
import { pricingApi } from '../pricing-api';
import type { ImportJob, ImportRowResult } from '../types';

export function useImportDetail(importId: string) {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [rows, setRows] = useState<ImportRowResult[]>([]);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    async function refresh(): Promise<void> {
      try {
        const [jobResponse, rowResponse, userResponse] = await Promise.all([
          pricingApi.getImport(importId, controller.signal),
          pricingApi.getImportRows(importId, controller.signal),
          pricingApi.getCurrentUser(controller.signal),
        ]);
        if (!active) return;
        setJob(jobResponse.import);
        setCanManage(['STORE_ADMIN', 'STORE_MANAGER'].includes(userResponse.user.role));
        setRows(rowResponse.rows);
        setError('');
        if (jobResponse.import.status === 'queued' || jobResponse.import.status === 'processing') {
          timer = setTimeout(() => { void refresh(); }, 3000);
        }
      } catch (cause) {
        if (!active || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Could not load this import');
        timer = setTimeout(() => { void refresh(); }, 3000);
      }
    }

    void refresh();
    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [importId, refreshVersion]);

  async function retryFailed(): Promise<void> {
    setRetrying(true);
    setRetryMessage('');
    setError('');
    try {
      const result = await pricingApi.retryImport(importId);
      setRetryMessage(`${result.retryRows} failed rows queued in a new job.`);
      setRefreshVersion((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not retry failed rows');
    } finally {
      setRetrying(false);
    }
  }

  async function downloadReport(): Promise<void> {
    if (!job) return;
    const filename = `${job.filename.replace(/\.csv$/i, '')}-results.csv`;
    try {
      await pricingApi.downloadImportReport(importId, filename);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download import report');
    }
  }

  return { job, rows, canManage, error, retrying, retryMessage, retryFailed, downloadReport };
}
