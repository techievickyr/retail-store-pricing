import { Router } from 'express';

const router = Router();
router.get('/health', (_request, response) => response.json({ status: 'ok' }));
export default router;
