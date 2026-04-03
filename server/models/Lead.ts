import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, index: true },
  email: { type: String },
  investmentInterest: { type: String },
  status: { 
    type: String, 
    enum: ['New', 'Interested', 'Not Interested', 'Callback', 'Converted'], 
    default: 'New',
    index: true
  },
  assignedAgent: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    index: true 
  },
  followUpDate: { type: Date, index: true },
  notes: [{
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  activityLog: [{
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Text index for search
leadSchema.index({ name: 'text', phone: 'text', email: 'text' });
// Compound index for status + assignedAgent
leadSchema.index({ status: 1, assignedAgent: 1 });

export const Lead = mongoose.model('Lead', leadSchema);
