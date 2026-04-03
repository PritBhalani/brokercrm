import cron from 'node-cron';
import { User, Attendance } from '../models/Models.ts';

export const initCronJobs = () => {
  // Run every day at 23:55 (11:55 PM) to mark absent agents
  cron.schedule('55 23 * * *', async () => {
    try {
      console.log('Running auto-absent cron job...');
      const today = new Date().toISOString().split('T')[0];
      
      const activeAgents = await User.find({ role: 'agent', isActive: true });
      
      for (const agent of activeAgents) {
        const attendance = await Attendance.findOne({ userId: agent._id, date: today });
        
        if (!attendance) {
          await Attendance.create({
            userId: agent._id,
            date: today,
            status: 'Absent' // loginTime omitted since it's now optional
          });
        }
      }
      console.log('Auto-absent cron job completed successfully.');
    } catch (error) {
      console.error('Error running auto-absent cron job:', error);
    }
  });
};
