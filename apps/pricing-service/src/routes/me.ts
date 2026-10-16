import { Router } from 'express';

const router = Router();
router.get('/me', (request, response) => response.json({ user: request.user }));
export default router;
