import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { requireRoles } from '../auth';
import { uploadPricingCsv } from '../middleware/csv-upload';
import { createImport } from '../services/import-service';

const router = Router();
router.post('/pricing-imports', requireRoles('STORE_MANAGER', 'STORE_ADMIN'), uploadPricingCsv, async (request, response) => {
  const file = request.file;
  if (!file) {
    response.status(400).json({ code: 'CSV_FILE_REQUIRED', message: 'Select a CSV file to upload', details: {}, correlationId: request.correlationId });
    return;
  }
  const result = await createImport({
    filename: file.originalname,
    storeId: String(request.body.storeId ?? ''),
    csvContent: file.buffer,
    user: request.user!,
    correlationId: request.correlationId ?? randomUUID(),
  });
  request.log.info({ jobId: result.id, storeId: request.body.storeId, bytes: file.size }, 'CSV import queued');
  response.status(202).json({ id: result.id, status: 'queued', filename: file.originalname, message: 'Import queued for processing' });
});
export default router;
