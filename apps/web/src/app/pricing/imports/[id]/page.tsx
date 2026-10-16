'use client';

import { useParams } from 'next/navigation';
import { ImportDetailView } from '@/features/pricing/components/import-detail-view';
import { useImportDetail } from '@/features/pricing/hooks/use-import-detail';

export default function ImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useImportDetail(id);
  return <ImportDetailView {...detail} />;
}
