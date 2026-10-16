'use client';

import { usePathname } from 'next/navigation';
import { PriceUploadView } from '@/features/pricing/components/price-upload-view';
import { usePriceUpload } from '@/features/pricing/hooks/use-price-upload';

export default function UploadPage() {
  const pathname = usePathname();
  return <UploadForm key={pathname} />;
}

function UploadForm() {
  const upload = usePriceUpload();
  return <PriceUploadView {...upload} />;
}
