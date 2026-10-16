import { Router } from 'express';
import { z } from 'zod';
import { requireRoles } from '../auth';
import { updateScheduledPrice } from '../services/price-write-service';
import { requirePathParam, ServiceError } from '../services/http-service';

const router = Router();
const updateSchema = z.object({
  price: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/).optional(),
  effectiveDate: z.string().optional(),
  version: z.number().int().positive(),
}).refine((input) => input.price !== undefined || input.effectiveDate !== undefined, 'Provide a price or effective date');

router.patch('/prices/:id', requireRoles('STORE_MANAGER', 'STORE_ADMIN'), async (request, response) => {
  const recordId = requirePathParam(request, 'id');
  const parsed = updateSchema.safeParse(request.body);
  if (!parsed.success) throw new ServiceError('Price update is invalid', 400, 'INVALID_PRICE_UPDATE', parsed.error.flatten());
  await updateScheduledPrice(request.user!, recordId, parsed.data, request.correlationId ?? '');
  response.json({ id: recordId, message: 'Scheduled price updated' });
});
export default router;
