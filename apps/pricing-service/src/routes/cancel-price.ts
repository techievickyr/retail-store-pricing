import { Router } from 'express';
import { requireRoles } from '../auth';
import { requirePathParam } from '../services/http-service';
import { cancelScheduledPrice } from '../services/price-write-service';

const router = Router();
router.delete('/prices/:id', requireRoles('STORE_MANAGER', 'STORE_ADMIN'), async (request, response) => {
  await cancelScheduledPrice(request.user!, requirePathParam(request, 'id'), request.correlationId ?? '');
  response.status(204).end();
});
export default router;
