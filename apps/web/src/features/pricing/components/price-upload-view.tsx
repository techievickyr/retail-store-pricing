'use client';

import Link from 'next/link';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { Check, FileSpreadsheet, FileUp, Info, LoaderCircle, Upload, X } from 'lucide-react';
import { BackLink } from '@/components/ui/back-link';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PageHeading } from '@/components/ui/page-heading';
import type { StoreOption } from '../types';

export interface PriceUploadViewProps {
  stores: StoreOption[];
  maxUploadBytes: number;
  storeId: string;
  setStoreId: (storeId: string) => void;
  file: File | null;
  progress: number;
  uploading: boolean;
  jobId: string;
  error: string;
  dragging: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (event: DragEvent<HTMLLabelElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  clearFile: () => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  cancelUpload: () => void;
}

export function PriceUploadView(props: PriceUploadViewProps) {
  const {
    stores, maxUploadBytes, storeId, setStoreId, file, progress, uploading, jobId, error, dragging,
    onFileChange, onDragOver, onDragLeave, onDrop, clearFile, submit, cancelUpload,
  } = props;
  const maxUploadMegabytes = (maxUploadBytes / (1024 * 1024)).toFixed(1);

  if (jobId) {
    return <div className="page-stack narrow-page">
      <BackLink href="/pricing">Back to price book</BackLink>
      <PageHeading eyebrow="PRICE OPERATIONS" title="Upload price feed" description="Schedule store prices from a validated CSV file." />
      <section className="success-panel" role="status"><span className="success-icon"><Check size={22} /></span><div><div className="eyebrow">UPLOAD RECEIVED</div><h2>Your import is queued</h2><p>The worker will validate each row and schedule valid prices. You can follow results in import history.</p><div className="success-actions"><Link className="button button-primary" href={`/pricing/imports/${jobId}`}>View import status</Link><Link className="button button-quiet" href="/pricing/imports">All imports</Link></div></div></section>
    </div>;
  }

  return <div className="page-stack narrow-page">
    <BackLink href="/pricing">Back to price book</BackLink>
    <PageHeading eyebrow="PRICE OPERATIONS" title="Upload price feed" description="Schedule store prices from a validated CSV file." action={<span className="step-count">01 <i>/</i> 02</span>} />
    <form onSubmit={submit} className="upload-form">
      <section className="filter-panel upload-context"><div className="section-topline"><div><h2>Feed details</h2><p>One store per upload. Your account permissions determine the available stores.</p></div><span className="step-badge">1</span></div><label className="field"><span>Store</span><select value={storeId} onChange={(event) => setStoreId(event.target.value)} disabled={!stores.length || uploading}><option value="">Select a store</option>{stores.map((store) => <option key={store.storeId} value={store.storeId}>{store.name} · {store.storeId} · {store.currency}</option>)}</select></label></section>
      <section className="filter-panel"><div className="section-topline"><div><h2>Choose CSV file</h2><p>Use one row per SKU and include a header row.</p></div><span className="step-badge">2</span></div>
        <label className={`dropzone${dragging ? ' drag-active' : ''}${file ? ' file-selected' : ''}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
          <input type="file" accept=".csv,text/csv" disabled={uploading} onChange={onFileChange} />
          {file ? <><span className="drop-icon selected"><FileSpreadsheet size={23} /></span><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(1)} KB · CSV file</span><button type="button" className="remove-file" aria-label="Remove selected file" disabled={uploading} onClick={(event) => { event.preventDefault(); clearFile(); }}><X size={16} /></button></> : <><span className="drop-icon"><FileUp size={23} /></span><strong>Drop your CSV here, or <em>browse files</em></strong><span>CSV format · Up to {maxUploadMegabytes} MB</span></>}
        </label>
        <div className="schema-note"><Info size={16} /><div><strong>Required columns</strong><span>Store ID, SKU, Product Name, Price, Date. Date must be a future YYYY-MM-DD value; blank dates default to tomorrow in the store timezone.</span></div></div>
      </section>
      {error && <Notice variant="error">{error}</Notice>}
      {uploading && <div className="progress-wrap" role="status"><div><span>Uploading feed</span><strong>{progress}%</strong></div><progress max="100" value={progress} /></div>}
      <div className="upload-footer"><span>Valid rows will process even if other rows fail.</span><div className="upload-controls">{uploading && <Button type="button" variant="quiet" onClick={cancelUpload}>Cancel upload</Button>}<Button type="submit" variant="primary" disabled={!file || !storeId || uploading} icon={uploading ? <LoaderCircle className="spin-icon" size={16} /> : <Upload size={16} />}>{uploading ? 'Uploading…' : 'Upload and validate'}</Button></div></div>
    </form>
  </div>;
}
