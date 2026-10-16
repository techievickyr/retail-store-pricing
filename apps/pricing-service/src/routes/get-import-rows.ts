import { Router } from 'express';
import { requirePathParam } from '../services/http-service';
import { getImportRows } from '../services/import-service';

const router = Router();
router.get('/pricing-imports/:id/errors', async (request, response) => {
  response.json({ rows: await getImportRows(request.user!, requirePathParam(request, 'id')) });
});
export default router;
