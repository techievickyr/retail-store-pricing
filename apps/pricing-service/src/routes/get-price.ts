import { Router } from 'express';
import { requirePathParam } from '../services/http-service';
import { getPrice } from '../services/pricing-service';

const router = Router();
router.get('/prices/:id', async (request, response) => {
  response.json({ price: await getPrice(request.user!, requirePathParam(request, 'id')) });
});
export default router;
