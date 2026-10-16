import { Router } from 'express';
import { listImports } from '../services/import-service';

const router = Router();
router.get('/pricing-imports', async (request, response) => {
  response.json({ imports: await listImports(request.user!) });
});
export default router;
