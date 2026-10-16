'use client';

import { ImportHistoryView } from '@/features/pricing/components/import-history-view';
import { useImportHistory } from '@/features/pricing/hooks/use-import-history';

export default function ImportsPage() {
  const history = useImportHistory();
  return <ImportHistoryView {...history} />;
}
