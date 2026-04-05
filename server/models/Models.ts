import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'agent'], default: 'agent' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  status: { 
    type: String, 
    enum: ['New', 'Interested', 'Callback', 'Converted', 'ReadyToWorkTomorrow'], 
    default: 'New' 
  },
  internalStatus: {
    type: String,
    enum: ['new', 'contacted', 'follow_up', 'interested', 'converted', 'not_interested'],
    default: 'new'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  investmentInterest: { type: String },
  nextFollowUpDate: { type: Date },
  notes: [{
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  activityLog: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    metadata: {
      fromAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      toAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: String
    }
  }],
  isActiveClient: { type: Boolean, default: false },
  isFreshTrader: { type: Boolean, default: false },
  readyForDate: { type: Date },
  /** First time lead became Paid (Converted); used for daily trade queue from next UTC day onward. */
  convertedAt: { type: Date },
  trades: [{
    type: { type: String, default: 'buy' },
    capital: { type: Number, required: true },
    buyQuantity: { type: Number, required: true },
    profit: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    /** Admin-defined slot name for this UTC day (e.g. Trade 1) when daily offers are configured */
    tradeSlotName: { type: String },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const Lead = mongoose.model('Lead', leadSchema);

/** Admin sets named trade slots per UTC calendar day; agents pick one when logging a buy. */
const dailyTradeOfferSchema = new mongoose.Schema({
  dayKey: { type: String, required: true, unique: true },
  slots: { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

export const DailyTradeOffer = mongoose.model('DailyTradeOffer', dailyTradeOfferSchema);

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
  read: { type: Boolean, default: false },
  link: String,
  createdAt: { type: Date, default: Date.now }
});

export const Notification = mongoose.model('Notification', notificationSchema);

const settingsSchema = new mongoose.Schema({
  officeStartTime: { type: String, default: '09:00' }, // HH:mm format
  officeEndTime: { type: String, default: '18:00' },   // HH:mm format
  isLocked: { type: Boolean, default: false },
  /** Preset names for UPI / collection account when logging payments (admin-managed) */
  collectionAccountLabels: { type: [String], default: ['Prit', 'Abhay', 'Pradip'] },
  updatedAt: { type: Date, default: Date.now }
});

export const SystemSettings = mongoose.model('SystemSettings', settingsSchema);

const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // Format YYYY-MM-DD
  loginTime: { type: Date },
  logoutTime: { type: Date },
  status: { type: String, enum: ['Present', 'Absent', 'Half Day'], default: 'Present' }
});

// Compound index for fast lookup of agent attendance per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model('Attendance', attendanceSchema);

const dailyReportSchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  
  // Lightweight Intent/Planning Overrides
  freshTraders: { type: Number, default: 0 },
  tomorrowActiveClients: { type: Number, default: 0 },
  notes: { type: String }
}, { timestamps: true });

dailyReportSchema.index({ agentId: 1, date: 1 }, { unique: true });

export const DailyReport = mongoose.model('DailyReport', dailyReportSchema);

const paymentSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Received'], default: 'Pending' },
  accountUsed: { type: String }, // e.g., 'UPI', 'Bank Transfer', 'Cash'
  /** Which UPI / collection account (e.g. agent name: Prit, Abhay, Pradip) */
  collectionAccountLabel: { type: String },
  expectedDate: { type: Date },
  /** When pending: expected date+time client will clear payment (optional, overrides date-only) */
  expectedClearanceAt: { type: Date },
  commission: {
    total: { type: Number, default: 0 },
    agentShare: { type: Number, default: 0 },
    companyShare: { type: Number, default: 0 }
  },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

export const Payment = mongoose.model('Payment', paymentSchema);

