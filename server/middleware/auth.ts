import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User, SystemSettings } from '../models/Models.ts';
import { getJwtSecret } from '../config/secrets.ts';

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded: any = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    if (user.role === 'agent') {
      const settings = await SystemSettings.findOne();
      
      if (settings?.isLocked) {
        return res.status(403).json({ message: 'System is locked by the admin.' });
      }

      if (settings?.officeEndTime) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const [endHour, endMinute] = settings.officeEndTime.split(':').map(Number);
        
        if (currentHour > endHour || (currentHour === endHour && currentMinute > endMinute)) {
          return res.status(403).json({ message: 'Office hours have ended. System is locked.' });
        }
      }
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `User role ${req.user.role} is not authorized to access this route` });
    }
    next();
  };
};
