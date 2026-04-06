import cron from 'node-cron';
import { User, Attendance } from '../models/Models.ts';

export const initCronJobs = () => {
  // Run every day at 23:55 (11:55 PM) to mark absent agents
  cron.schedule('55 23 * * *', async () => {
    try {
      const now = new Date();
      if (now.getUTCDay() === 0) {
        console.log('Auto-absent skipped: Sunday (UTC) — office closed.');
        return;
      }
      console.log('Running auto-absent cron job...');
      const today = now.toISOString().split('T')[0];

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
