'use client';

import { useParams } from 'next/navigation';
import { PriceDetailView } from '@/features/pricing/components/price-detail-view';
import { usePriceDetail } from '@/features/pricing/hooks/use-price-detail';

export default function PriceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = usePriceDetail(id);
  return <PriceDetailView {...detail} />;
}
