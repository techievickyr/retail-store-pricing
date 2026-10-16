import { Router } from 'express';
import { requireRoles } from '../auth';
import { requirePathParam } from '../services/http-service';
import { deletePriceHistory } from '../services/price-write-service';

const router = Router();
router.delete('/prices/:id/history', requireRoles('STORE_ADMIN'), async (request, response) => {
  await deletePriceHistory(request.user!, requirePathParam(request, 'id'), request.correlationId ?? '');
  response.status(204).end();
});
export default router;
