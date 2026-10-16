import { Router } from 'express';
import { getAccessibleStores } from '../services/catalog-service';

const router = Router();
router.get('/stores', async (request, response) => {
  response.json({ stores: await getAccessibleStores(request.user!) });
});
export default router;
