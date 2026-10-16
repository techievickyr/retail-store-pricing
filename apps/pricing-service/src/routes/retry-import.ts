import { Router } from 'express';
import { requireRoles } from '../auth';
import { requirePathParam } from '../services/http-service';
import { retryFailedImport } from '../services/import-service';

const router = Router();
router.post('/pricing-imports/:id/retry', requireRoles('STORE_MANAGER', 'STORE_ADMIN'), async (request, response) => {
  const result = await retryFailedImport(request.user!, requirePathParam(request, 'id'), request.correlationId ?? '');
  response.status(202).json({ id: result.id, status: 'queued', retryRows: result.retryRows });
});
export default router;
