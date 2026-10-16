import { Router } from 'express';
import { listMockUsers } from '../services/user-service';

const router = Router();
router.get('/users', (request, response) => response.json({ users: listMockUsers(request.user!) }));
export default router;
