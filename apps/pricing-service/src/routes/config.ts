import { Router } from 'express';
import { getPublicConfig } from '../services/config-service';

const router = Router();
router.get('/config', (_request, response) => response.json(getPublicConfig()));
export default router;
