import express from 'express';
import * as notificationController from '../controllers/notificationController.ts';
import { protect } from '../middleware/auth.ts';

const router = express.Router();

router.use(protect);

router.get('/', notificationController.getNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);
router.post('/', notificationController.createNotification);

export default router;
