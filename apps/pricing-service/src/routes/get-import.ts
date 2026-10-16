import { Router } from 'express';
import { requirePathParam } from '../services/http-service';
import { getImport } from '../services/import-service';

const router = Router();
router.get('/pricing-imports/:id', async (request, response) => {
  response.json({ import: await getImport(request.user!, requirePathParam(request, 'id')) });
});
export default router;
