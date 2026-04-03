import { Response } from 'express';
import { Notification } from '../models/Models.ts';
import { AuthRequest } from '../middleware/auth.ts';

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await Notification.find({ userId: req.user?._id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    await Notification.updateMany(
      { userId: req.user?._id, read: false },
      { read: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createNotification = async (req: AuthRequest, res: Response) => {
  try {
    const notification = new Notification({
      ...req.body,
      userId: req.user?._id
    });
    await notification.save();
    res.status(201).json(notification);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
