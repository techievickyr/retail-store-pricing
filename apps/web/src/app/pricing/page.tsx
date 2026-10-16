'use client';

import { PriceBookView } from '@/features/pricing/components/price-book-view';
import { usePriceSearch } from '@/features/pricing/hooks/use-price-search';

export default function PricingPage() {
  const search = usePriceSearch();
  return <PriceBookView {...search} />;
}
