import { Router } from 'express';
import { searchProducts } from '../services/catalog-service';

const router = Router();
router.get('/products', async (request, response) => {
  const query = String(request.query.q ?? '');
  response.json({ products: await searchProducts(query) });
});
export default router;
