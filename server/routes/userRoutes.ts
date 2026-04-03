import express from 'express';
import { loginUser, logoutUser, getAgents, createAgent, getMe, toggleAgentStatus } from '../controllers/userController.ts';
import { protect, authorize } from '../middleware/auth.ts';

const router = express.Router();

router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getMe);
router.get('/agents', protect, authorize('admin'), getAgents);
router.post('/agents', protect, authorize('admin'), createAgent);
router.patch('/agents/:id/status', protect, authorize('admin'), toggleAgentStatus);

export default router;
