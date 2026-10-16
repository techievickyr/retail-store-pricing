import { Router } from 'express';
import { requirePathParam } from '../services/http-service';
import { getPriceHistory } from '../services/price-history-service';

const router = Router();
router.get('/prices/:id/history', async (request, response) => {
  response.json({ events: await getPriceHistory(request.user!, requirePathParam(request, 'id')) });
});
export default router;
