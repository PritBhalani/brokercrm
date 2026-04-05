import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, Lead, SystemSettings, Attendance } from '../models/Models.ts';
import { getJwtSecret } from '../config/secrets.ts';

const generateToken = (id: string) => {
  return jwt.sign({ id }, getJwtSecret(), { expiresIn: '30d' });
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const emailTrim = email.trim();
    const user = await User.findOne({ email: emailTrim });

    if (!user) {
      // Bootstrap the first admin if it's the owner's email and no users exist
      const userCount = await User.countDocuments();

      if (userCount === 0 && emailTrim === 'pprit746@gmail.com') {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = await User.create({
          name: 'Super Admin',
          email: emailTrim,
          password: hashedPassword,
          role: 'admin',
          isActive: true
        });
        
        return res.json({
          _id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          token: generateToken(newUser._id.toString())
        });
      }
      
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.password || typeof user.password !== 'string') {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      if (user.role === 'agent') {
        if (!user.isActive) {
          return res.status(403).json({ message: 'Your account is deactivated.' });
        }

        let settings = await SystemSettings.findOne();
        if (!settings) {
          settings = await SystemSettings.create({ isLocked: false, officeStartTime: '09:00', officeEndTime: '18:00' });
        }
        
        if (settings.isLocked) {
          return res.status(403).json({ message: 'System is currently locked by the admin.' });
        }

        if (settings.officeEndTime) {
          const now = new Date();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const [endHour, endMinute] = settings.officeEndTime.split(':').map(Number);
          
          if (currentHour > endHour || (currentHour === endHour && currentMinute > endMinute)) {
            return res.status(403).json({ message: 'Office hours have ended.' });
          }
        }

        // Record attendance
        const today = new Date().toISOString().split('T')[0];
        try {
          await Attendance.updateOne(
            { userId: user._id, date: today },
            { $setOnInsert: { userId: user._id, date: today, loginTime: new Date(), status: 'Present' } },
            { upsert: true }
          );
        } catch (err) {
          console.error('Error recording attendance:', err);
        }
      }

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id.toString())
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    const detail = error instanceof Error ? error.message : String(error);
    const showDetail = process.env.VERCEL_DEBUG === '1';
    res.status(500).json({
      message: 'Server error',
      ...(showDetail && { detail }),
    });
  }
};

export const getAgents = async (req: Request, res: Response) => {
  try {
    const agents = await User.find({ role: 'agent' }).select('-password');
    res.json(agents);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMe = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const createAgent = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  try {
    const userExists = await User.findOne({ email });
    
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const agent = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'agent',
      isActive: true
    });

    res.status(201).json({
      _id: agent._id,
      name: agent.name,
      email: agent.email,
      role: 'agent'
    });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const toggleAgentStatus = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'agent') {
      return res.status(404).json({ message: 'Agent not found' });
    }

    user.isActive = !user.isActive;
    await user.save();

    if (!user.isActive) {
      await Lead.updateMany(
        { assignedAgent: user._id },
        { 
          $set: { assignedAgent: null },
          $push: { 
            activityLog: {
              action: `Agent ${user.name} deactivated, lead marked as unassigned`,
              performedBy: req.user._id,
              timestamp: new Date()
            }
          }
        }
      );
    }

    res.json({ message: `Agent ${user.isActive ? 'activated' : 'deactivated'} successfully`, user });
  } catch (error) {
    console.error('Toggle agent status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const logoutUser = async (req: any, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await Attendance.updateOne(
      { userId: req.user._id, date: today },
      { $set: { logoutTime: new Date() } }
    );
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
