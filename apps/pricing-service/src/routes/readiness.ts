import { Router } from 'express';
import { checkReadiness } from '../services/health-service';

const router = Router();
router.get('/ready', async (_request, response) => {
  const result = await checkReadiness();
  response.status(result.ready ? 200 : 503).json({ status: result.ready ? 'ready' : 'not-ready', database: result.ready ? 'ok' : 'unavailable' });
});
export default router;
