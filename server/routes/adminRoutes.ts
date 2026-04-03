import express from 'express';
import {
  getSettings,
  updateSettings,
  getAttendance,
  getDashboardStats,
  getAgentFullSummary,
  listPayments,
} from '../controllers/adminController.ts';
import { protect, authorize } from '../middleware/auth.ts';

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.get('/attendance', getAttendance);
router.get('/stats', getDashboardStats);
router.get('/payments', listPayments);
router.get('/agent/:id/summary', getAgentFullSummary);

export default router;
