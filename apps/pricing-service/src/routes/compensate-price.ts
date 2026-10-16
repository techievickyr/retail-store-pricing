import { Router } from 'express';
import { z } from 'zod';
import { requireRoles } from '../auth';
import { requirePathParam, ServiceError } from '../services/http-service';
import { scheduleCompensatingPrice } from '../services/price-write-service';

const router = Router();
const undoSchema = z.object({ auditEventId: z.number().int().positive() });

router.post('/prices/:id/undo', requireRoles('STORE_MANAGER', 'STORE_ADMIN'), async (request, response) => {
  const parsed = undoSchema.safeParse(request.body);
  if (!parsed.success) throw new ServiceError('Provide a valid audit event ID', 400, 'INVALID_AUDIT_EVENT');
  const result = await scheduleCompensatingPrice(request.user!, requirePathParam(request, 'id'), parsed.data.auditEventId, request.correlationId ?? '');
  response.status(201).json({ ...result, message: 'Compensating price change scheduled' });
});
export default router;
