'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { ApiError, uploadCsv } from '@/lib/api';
import { pricingApi } from '../pricing-api';
import type { StoreOption, UploadLimitsResponse } from '../types';

const defaultUploadLimits: UploadLimitsResponse = { maxUploadBytes: 5 * 1024 * 1024 };

export function usePriceUpload() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [limits, setLimits] = useState<UploadLimitsResponse>(defaultUploadLimits);
  const [storeId, setStoreId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const uploadController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      pricingApi.getStores(controller.signal),
      pricingApi.getUploadLimits(controller.signal),
    ]).then(([availableStores, uploadLimits]) => {
      if (controller.signal.aborted) return;
      setStores(availableStores);
      if (availableStores[0]) setStoreId(availableStores[0].storeId);
      setLimits(uploadLimits);
    }).catch((cause: Error) => {
      if (!controller.signal.aborted) setError(cause.message);
    });
    return () => {
      controller.abort();
      uploadController.current?.abort();
    };
  }, []);

  function selectFile(candidate?: File): void {
    setError('');
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith('.csv')) { setError('Choose a .csv file.'); return; }
    if (candidate.size > limits.maxUploadBytes) {
      setError(`This file exceeds the ${(limits.maxUploadBytes / (1024 * 1024)).toFixed(1)} MB configured limit.`);
      return;
    }
    setFile(candidate);
    setJobId('');
    setProgress(0);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>): void {
    selectFile(event.currentTarget.files?.[0]);
  }

  function onDragOver(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setDragging(true);
  }

  function onDragLeave(): void {
    setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  function clearFile(): void {
    setFile(null);
    setProgress(0);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!file || !storeId) return;
    const controller = new AbortController();
    uploadController.current = controller;
    setUploading(true);
    setError('');
    try {
      const job = await uploadCsv(storeId, file, setProgress, controller.signal);
      setJobId(job.id);
      setProgress(100);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof ApiError ? cause.message : 'Upload failed. Try again.');
    } finally {
      if (uploadController.current === controller) uploadController.current = null;
      setUploading(false);
    }
  }

  function cancelUpload(): void {
    setError('Upload cancelled. Check import history in case the server accepted it just before cancellation.');
    uploadController.current?.abort();
  }

  return {
    stores,
    maxUploadBytes: limits.maxUploadBytes,
    storeId,
    setStoreId,
    file,
    progress,
    uploading,
    jobId,
    error,
    dragging,
    onFileChange,
    onDragOver,
    onDragLeave,
    onDrop,
    clearFile,
    submit,
    cancelUpload,
  };
}
