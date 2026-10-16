'use client';

import { useEffect, useState } from 'react';
import { pricingApi } from '../pricing-api';
import type { ImportJob } from '../types';

export function useImportHistory() {
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    async function refresh(): Promise<void> {
      try {
        const response = await pricingApi.getImports(controller.signal);
        if (active) { setImports(response.imports); setError(''); }
      } catch (cause) {
        if (active && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load imports');
      } finally {
        if (active) setLoading(false);
      }
      if (active) timer = setTimeout(() => { void refresh(); }, 4000);
    }

    void refresh();
    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [refreshVersion]);

  return {
    imports,
    error,
    loading,
    inProgressCount: imports.filter((job) => job.status === 'queued' || job.status === 'processing').length,
    refresh: () => setRefreshVersion((current) => current + 1),
  };
}
