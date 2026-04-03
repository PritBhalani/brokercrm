import express from 'express';
import { getDailyReport, updateDailyReport } from '../controllers/dailyReportController.ts';
import { protect, authorize } from '../middleware/auth.ts';

const router = express.Router();

router.use(protect);

// Agents update their manual daily report fields
router.put('/today', updateDailyReport);

// Admins fetch the unified computed daily report across all agents
router.get('/today', authorize('admin'), getDailyReport);

export default router;
