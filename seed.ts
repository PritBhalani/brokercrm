import mongoose from 'mongoose';
import { User } from './server/models/User.ts';
import { Lead } from './server/models/Lead.ts';
import dotenv from 'dotenv';

dotenv.config();

const seed = async () => {
  try {
    const uri = process.env.MONGODB_URI?.trim();
    if (!uri) {
      console.error('Set MONGODB_URI in .env (e.g. Atlas connection string).');
      process.exit(1);
    }
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Lead.deleteMany({});

    // Create Admin
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin'
    });
    console.log('Admin created: admin@example.com / password123');

    // Create Agents
    const agent1 = await User.create({
      name: 'Agent One',
      email: 'agent1@example.com',
      password: 'password123',
      role: 'agent'
    });
    const agent2 = await User.create({
      name: 'Agent Two',
      email: 'agent2@example.com',
      password: 'password123',
      role: 'agent'
    });
    console.log('Agents created');

    // Create Sample Leads
    const leads = [
      {
        name: 'John Smith',
        phone: '1234567890',
        email: 'john@example.com',
        investmentInterest: 'Equity',
        status: 'New',
        assignedAgent: agent1._id
      },
      {
        name: 'Sarah Connor',
        phone: '0987654321',
        email: 'sarah@example.com',
        investmentInterest: 'Mutual Funds',
        status: 'Interested',
        assignedAgent: agent2._id
      },
      {
        name: 'Bruce Wayne',
        phone: '5551234567',
        email: 'bruce@wayne.com',
        investmentInterest: 'Real Estate',
        status: 'Callback',
        assignedAgent: agent1._id,
        followUpDate: new Date(Date.now() + 86400000) // Tomorrow
      }
    ];

    await Lead.insertMany(leads);
    console.log('Sample leads created');

    process.exit();
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
