import { Request, Response } from 'express';
import { Lead, User, Payment, SystemSettings } from '../models/Models.ts';

const DEFAULT_COLLECTION_LABELS = ['Prit', 'Abhay', 'Pradip'];

/** Preset UPI / collection account names (same source as admin settings) — for payment form dropdown. */
export const getCollectionLabels = async (req: any, res: Response) => {
  try {
    const settings = await SystemSettings.findOne();
    const labels =
      settings?.collectionAccountLabels?.length ? settings.collectionAccountLabels : DEFAULT_COLLECTION_LABELS;
    res.json({ labels });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
};

let roundRobinAgentIds: string[] = [];
let roundRobinIndex = 0;

const getNextRoundRobinAgentId = async (): Promise<string | null> => {
  const agents = await User.find({ role: 'agent', isActive: true }).sort({ createdAt: 1, _id: 1 }).select('_id');
  const agentIds = agents.map((agent: any) => agent._id.toString());

  if (agentIds.length === 0) return null;

  // Reset cursor when agent pool changes.
  const poolChanged =
    agentIds.length !== roundRobinAgentIds.length ||
    agentIds.some((id, idx) => id !== roundRobinAgentIds[idx]);

  if (poolChanged) {
    roundRobinAgentIds = agentIds;
    roundRobinIndex = 0;
  }

  const nextAgentId = roundRobinAgentIds[roundRobinIndex];
  roundRobinIndex = (roundRobinIndex + 1) % roundRobinAgentIds.length;
  return nextAgentId;
};

const getUTCDayBounds = (d: Date) => {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
};

const getAssignedAgentId = (lead: any): string | null => {
  if (!lead?.assignedAgent) return null;
  return typeof lead.assignedAgent === 'object'
    ? lead.assignedAgent?._id?.toString() ?? null
    : lead.assignedAgent?.toString?.() ?? String(lead.assignedAgent);
};

const assertCanMutateLead = (req: any, lead: any, res: Response) => {
  if (req.user?.role === 'admin') return true;
  if (req.user?.role === 'agent') {
    const assignedAgentId = getAssignedAgentId(lead);
    if (!assignedAgentId || assignedAgentId !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to modify this lead' });
      return false;
    }
  }
  return true;
};

const hasAgentTrade = (lead: any) => {
  return Array.isArray(lead?.trades) && lead.trades.some((t: any) => Number(t?.buyQuantity ?? 0) > 0);
};

export const getLeads = async (req: any, res: Response) => {
  const limitCount = parseInt(req.query.limit as string) || 50;
  const search = req.query.search as string;
  const status = req.query.status as string;
  // Admin can filter by assigned agent. For backwards compatibility we accept `agentId` too.
  const assignedAgent = req.query.assignedAgent as string;
  const agentId = req.query.agentId as string;

  try {
    let queryObj: any = {};

    if (req.user.role === 'agent') {
      queryObj.assignedAgent = req.user._id;
    } else {
      // Admin: allow filtering by assignedAgent.
      const filterValue = assignedAgent || agentId;
      if (filterValue && filterValue !== 'all') {
        if (filterValue === 'unassigned') {
          queryObj.assignedAgent = null;
        } else {
          queryObj.assignedAgent = filterValue;
        }
      }
    }

    if (status) {
      queryObj.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      queryObj.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex }
      ];
    }

    // Follow-up execution: if this agent has any due/overdue leads, only return those.
    // This prevents agents from "ignoring" due follow-ups while keeping the rest of the query intact.
    // `workbench=true` skips this so the agent dashboard can show full buckets (overdue / today / queue).
    const agentWorkbench =
      req.query.workbench === 'true' || req.query.workbench === '1';
    if (req.user.role === 'agent' && !agentWorkbench) {
      const now = new Date();
      const dueQuery = {
        ...queryObj,
        nextFollowUpDate: { $lte: now }
      };
      // If due/overdue leads exist, agents should not be able to "hide" them via the status filter.
      delete (dueQuery as any).status;
      const dueCount = await Lead.countDocuments(dueQuery);
      if (dueCount > 0) {
        queryObj = dueQuery;
      }
    }

    const totalMatching = await Lead.countDocuments(queryObj);

    const leads = await Lead.find(queryObj)
      // Due/overdue follow-ups use `nextFollowUpDate`; earliest due first.
      .sort({ nextFollowUpDate: 1, createdAt: -1 })
      .limit(limitCount)
      .populate('assignedAgent', 'name email');

    // `total` = rows matching filters in DB; `leads.length` may be lower due to `limit`.
    res.json({ leads, total: totalMatching, limit: limitCount });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getLeadById = async (req: any, res: Response) => {
  try {
    const lead = await Lead.findById(req.params.id).populate('assignedAgent', 'name email');
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const assignedAgentValue: any = lead.assignedAgent;
    const assignedAgentId = assignedAgentValue
      ? (typeof assignedAgentValue === 'object'
          ? assignedAgentValue._id?.toString()
          : String(assignedAgentValue))
      : null;

    if (req.user.role === 'agent' && assignedAgentId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this lead' });
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateLeadStatus = async (req: any, res: Response) => {
  const { status, followUpDate, note } = req.body;
  try {
    const lead: any = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (!assertCanMutateLead(req, lead, res)) return;

    if (status) {
      // Enforce conversion workflow integrity.
      if (status === 'Converted') {
        if (!hasAgentTrade(lead)) {
          return res.status(400).json({ message: 'Cannot convert: at least one trade must exist.' });
        }

        const paymentQuery: any = {
          leadId: lead._id,
          status: 'Received'
        };
        // For agents, tie "valid payment" to the authenticated agent to avoid cross-agent manipulation.
        if (req.user.role === 'agent') paymentQuery.agentId = req.user._id;

        const hasReceivedPayment = await Payment.exists(paymentQuery);
        if (!hasReceivedPayment) {
          return res.status(400).json({ message: 'Cannot convert: at least one received payment must exist.' });
        }
      }

      const wasPaid = lead.status === 'Converted';
      if (status === 'Converted' && !wasPaid) {
        lead.convertedAt = new Date();
      }

      lead.status = status;
      // Internal mapping
      const mapping: any = {
        'New': 'new', 'Interested': 'interested', 'Callback': 'follow_up', 
        'Converted': 'converted', 'ReadyToWorkTomorrow': 'interested'
      };
      lead.internalStatus = mapping[status] || 'new';

      // Auto-assign priority
      if (status === 'Converted' || status === 'ReadyToWorkTomorrow') lead.priority = 'high';
      else if (status === 'Interested') lead.priority = 'medium';
    }
    
    if (status === 'Ready to work tomorrow' || status === 'ReadyToWorkTomorrow') {
      lead.nextFollowUpDate = new Date(Date.now() + 86400000); // Set to tomorrow
      lead.isActiveClient = true;
    } else if (followUpDate) {
      lead.nextFollowUpDate = new Date(followUpDate);
      
      // Upgrade priority if overdue
      const now = new Date();
      if (lead.nextFollowUpDate < now && lead.status !== 'Converted') {
        lead.priority = 'high';
      }
    }
    
    if (note) {
      if (!lead.notes) lead.notes = [];
      lead.notes.push({ text: note, createdAt: new Date() });
    }

    if (!lead.activityLog) lead.activityLog = [];
    lead.activityLog.push({
      action: `Status updated to ${status}`,
      performedBy: req.user._id,
      timestamp: new Date()
    });

    lead.updatedAt = new Date();
    await lead.save();
    
    res.json(lead);
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const markAsFT = async (req: any, res: Response) => {
  try {
    const lead: any = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (lead.isActiveClient) {
      return res.status(400).json({ message: 'Client is already active. Cannot be marked as FT.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(todayStr + 'T00:00:00Z');
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    lead.isFreshTrader = true;
    lead.readyForDate = tomorrow;
    lead.updatedAt = new Date();
    lead.activityLog.push({
      action: 'Marked as Fresh Trader (FT) for tomorrow',
      performedBy: req.user._id,
      timestamp: new Date()
    });

    await lead.save();

    let warnings: string[] = [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const hasRecentActivity = lead.activityLog?.some((log: any) => new Date(log.timestamp) >= sevenDaysAgo);
    if (!hasRecentActivity) {
       warnings.push('Marked as FT, but client has no activity logged in the last 7 days.');
    }

    res.json({ lead, warnings });
  } catch (error) {
    console.error('Mark FT error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const addPayment = async (req: any, res: Response) => {
  const {
    amount,
    status,
    accountUsed,
    expectedDate,
    expectedClearanceAt,
    collectionAccountLabel,
    commissionTotal,
    commissionAgentShare,
    commissionCompanyShare,
  } = req.body;
  try {
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
       return res.status(400).json({ message: 'Payment amount must be greater than 0.' });
    }
    if (!accountUsed || accountUsed.trim() === '') {
       return res.status(400).json({ message: 'Account used is required.' });
    }
    if (status === 'Pending' && !expectedDate && !expectedClearanceAt) {
      return res.status(400).json({
        message: 'For pending payments, provide expected clearance (date or date+time).',
      });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (!assertCanMutateLead(req, lead, res)) return;

    // Payment integrity: require trade exists before logging payment.
    if (!Array.isArray(lead.trades) || lead.trades.length === 0) {
      return res.status(400).json({ message: 'Cannot log payment: at least one trade must exist first.' });
    }

    const ec = expectedClearanceAt ? new Date(expectedClearanceAt) : undefined;
    const ed = expectedDate ? new Date(expectedDate) : ec ? ec : undefined;

    const newPayment = await Payment.create({
      leadId: lead._id,
      agentId: req.user._id,
      amount: numAmount,
      status: status || 'Pending',
      accountUsed: accountUsed,
      collectionAccountLabel: collectionAccountLabel?.trim() || undefined,
      expectedDate: ed,
      expectedClearanceAt: ec,
      commission: {
        total: Number(commissionTotal) || 0,
        agentShare: Number(commissionAgentShare) || 0,
        companyShare: Number(commissionCompanyShare) || 0
      },
      date: new Date()
    });

    const acctBits = [accountUsed, collectionAccountLabel?.trim()].filter(Boolean).join(' · ');
    lead.activityLog.push({
      action: `Logged Payment - ₹${amount} (${status}) via ${acctBits}`,
      performedBy: req.user._id,
      timestamp: new Date(),
    });
    
    lead.isActiveClient = true;
    await lead.save();

    let warnings: string[] = [];

    // Warning 1: No recent trades despite a payment being logged
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const hasRecentTrades = lead.trades?.some((t: any) => new Date(t.date) >= thirtyDaysAgo);
    if (!hasRecentTrades) {
       warnings.push('Payment received, but no recent trading activity found (last 30 days).');
    }

    // Warning 2: Agent's total pending exceeds total received → financial risk
    const agentPaymentSummary = await Payment.aggregate([
      { $match: { agentId: req.user._id } },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' }
        }
      }
    ]);

    const pendingTotal  = agentPaymentSummary.find((g: any) => g._id === 'Pending')?.total  ?? 0;
    const receivedTotal = agentPaymentSummary.find((g: any) => g._id === 'Received')?.total ?? 0;

    if (pendingTotal > receivedTotal) {
      const riskRatio = pendingTotal / (receivedTotal || 1);
      const p = `₹${pendingTotal.toLocaleString('en-IN')}`;
      const r = `₹${receivedTotal.toLocaleString('en-IN')}`;

      if (riskRatio >= 2) {
        warnings.push(
          `🔴 High financial risk: Pending (${p}) is ${riskRatio.toFixed(1)}x collected (${r}). Immediate follow-up required.`
        );
      } else {
        warnings.push(
          `🟡 Moderate risk: Pending payments (${p}) slightly exceed collections (${r}). Monitor closely.`
        );
      }
    }

    res.status(201).json({ payment: newPayment, warnings });

  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const addTrade = async (req: any, res: Response) => {
  const { capital, buyQuantity, profit } = req.body;
  
  // Configuration: Threshold limits to reject extremely large inputs
  const MAX_BUY_QUANTITY = 500000;
  
  try {
    const numBuyQuantity = Number(buyQuantity);
    if (!buyQuantity || isNaN(numBuyQuantity) || numBuyQuantity <= 0) {
      return res.status(400).json({ message: 'Buy quantity must be greater than 0.' });
    }
    if (numBuyQuantity > MAX_BUY_QUANTITY) {
      return res.status(400).json({ message: `Quantity rejected. Exceeds global circuit breaker (${MAX_BUY_QUANTITY.toLocaleString()}).` });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (!assertCanMutateLead(req, lead, res)) return;

    if (req.user.role !== 'admin') {
      const progressed = lead.internalStatus && lead.internalStatus !== 'new';
      if (!progressed) {
        return res.status(400).json({ message: 'Must progress the lead status (not "New") before adding a trade.' });
      }
    }

    const newTrade: any = {
      capital: Number(capital) || 0,
      buyQuantity: numBuyQuantity,
      profit: Number(profit) || 0,
      date: new Date()
    };
    
    lead.trades.push(newTrade);

    lead.activityLog.push({
      action: `Added Trade - Cap: ₹${capital}, Qty: ${buyQuantity}, Profit: ₹${profit}`,
      performedBy: req.user._id,
      timestamp: new Date()
    });

    lead.isActiveClient = true; // Auto-activate if they have a trade
    await lead.save();
    
    let warnings: string[] = [];
    const { start: startOfDay, end: endOfDay } = getUTCDayBounds(new Date());

    const todaysTrades = lead.trades.filter((t: any) => {
      const ts = new Date(t.date);
      return ts >= startOfDay && ts <= endOfDay;
    });
    const totalTodayQty = todaysTrades.reduce((sum: number, t: any) => sum + t.buyQuantity, 0);

    // Threshold for significant buy quantity warning (configurable)
    if (totalTodayQty >= 50000) {
      const paymentsToday = await Payment.countDocuments({
         leadId: lead._id,
         date: { $gte: startOfDay, $lte: endOfDay }
      });
      if (paymentsToday === 0) {
         warnings.push("High trade activity today but no payment recorded. Please collect margin.");
      }
    }

    res.json({ lead, warnings });
  } catch (error) {
    console.error('Add trade error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** UTC calendar day string YYYY-MM-DD */
const utcDayKey = (d: Date) => d.toISOString().split('T')[0];

/** Paid clients: use stored convertedAt, else infer from activity log (legacy). */
const getPaidClientStartDay = (lead: any): string | null => {
  if (lead.convertedAt) return utcDayKey(new Date(lead.convertedAt));
  const logs = [...(lead.activityLog || [])].reverse();
  const log = logs.find((l: any) => String(l.action ?? '').includes('Status updated to Converted'));
  return log?.timestamp ? utcDayKey(new Date(log.timestamp)) : null;
};

/**
 * Who appears on today's trade queue (UTC).
 * - Paid clients (`Converted`): from the next UTC day after conversion onward (not same day as conversion).
 * - FT: only when `readyForDate` is today's UTC date (scheduled FT day).
 * - Active + Interested / Callback / ReadyToWorkTomorrow unchanged.
 */
const isEligibleForDailyTrade = (lead: any, utcDayStart: Date) => {
  const todayStr = utcDayKey(utcDayStart);

  if (lead.status === 'Converted') {
    const paidDay = getPaidClientStartDay(lead);
    if (!paidDay) return false;
    return paidDay < todayStr;
  }

  const readyStr = lead.readyForDate
    ? utcDayKey(new Date(lead.readyForDate))
    : null;
  const freshTraderDueToday = !!lead.isFreshTrader && !!readyStr && readyStr === todayStr;

  return (
    !!lead.isActiveClient ||
    freshTraderDueToday ||
    ['Interested', 'Callback', 'ReadyToWorkTomorrow'].includes(lead.status)
  );
};

const hasNoTradeRecordedToday = (lead: any, start: Date, end: Date) => {
  return (lead.activityLog || []).some((log: any) => {
    const action = String(log?.action ?? '');
    if (!action.includes('No trade today')) return false;
    const ts = log?.timestamp ? new Date(log.timestamp) : null;
    return !!ts && ts >= start && ts <= end;
  });
};

/** Agent: clients who still need a buy trade OR explicit "no trade" for today (UTC). */
export const getAgentTradeQueue = async (req: any, res: Response) => {
  try {
    if (req.user.role !== 'agent') {
      return res.status(403).json({ message: 'Agents only' });
    }
    const agentId = req.user._id;
    const { start, end } = getUTCDayBounds(new Date());

    const leads = await Lead.find({ assignedAgent: agentId })
      .select('name phone status isActiveClient isFreshTrader readyForDate convertedAt trades activityLog')
      .lean();

    const queue: any[] = [];
    const tradedToday: any[] = [];

    for (const lead of leads) {
      const tradesToday = (lead.trades || []).filter((t: any) => {
        const ts = new Date(t.date);
        return ts >= start && ts <= end && Number(t.buyQuantity) > 0;
      });

      if (tradesToday.length > 0) {
        tradedToday.push({
          _id: lead._id,
          name: lead.name,
          phone: lead.phone,
          buyQtyToday: tradesToday.reduce((s: number, t: any) => s + Number(t.buyQuantity), 0),
        });
        continue;
      }

      if (!isEligibleForDailyTrade(lead, start)) continue;
      if (hasNoTradeRecordedToday(lead, start, end)) continue;

      queue.push({
        _id: lead._id,
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        isActiveClient: lead.isActiveClient,
        isFreshTrader: lead.isFreshTrader,
      });
    }

    res.json({
      queue,
      tradedToday,
      utcDate: start.toISOString().split('T')[0],
    });
  } catch (error) {
    console.error('getAgentTradeQueue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Record that this client did not trade today (still counts as daily visit outcome). */
export const recordNoTradeToday = async (req: any, res: Response) => {
  const { note } = req.body;
  try {
    const lead: any = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (!assertCanMutateLead(req, lead, res)) return;

    const { start, end } = getUTCDayBounds(new Date());
    if (hasNoTradeRecordedToday(lead, start, end)) {
      return res.status(400).json({ message: 'No trade already recorded for today.' });
    }

    const msg = note && String(note).trim() ? String(note).trim() : 'Client did not take a trade today';
    lead.activityLog.push({
      action: `No trade today: ${msg}`,
      performedBy: req.user._id,
      timestamp: new Date(),
    });
    lead.updatedAt = new Date();
    await lead.save();
    res.json({ lead });
  } catch (error) {
    console.error('recordNoTradeToday error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const assignLead = async (req: any, res: Response) => {
  const { agentId } = req.body;
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Manual assignment bypasses round-robin. If agentId is omitted, use round-robin.
    const assignedAgentId = agentId || await getNextRoundRobinAgentId();
    lead.assignedAgent = assignedAgentId || null;
    lead.updatedAt = new Date();
    lead.activityLog.push({
      action: assignedAgentId ? `Lead assigned to agent ${assignedAgentId}` : 'Lead assignment attempted but no agents available',
      performedBy: req.user._id,
      timestamp: new Date()
    });

    await lead.save();
    
    // Emit socket event for each successful assignment.
    if (assignedAgentId) {
      const io = req.app.get('socketio');
      io.to(assignedAgentId).emit('new_lead', { leadId: lead._id, name: lead.name });
    }

    res.json(lead);
  } catch (error) {
    console.error('Assign lead error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createLead = async (req: any, res: Response) => {
  const { name, phone, email, status, assignedAgent, investmentInterest } = req.body;
  try {
    // Lead is unassigned by default unless an agent is manually assigned at creation
    const assignedAgentId = assignedAgent || null;
    const normalizedPhone = phone.replace(/\D/g, '').slice(-10); // Keep last 10 digits

    const lead = await Lead.create({
      name,
      phone: normalizedPhone,
      email,
      status: status || 'New',
      assignedAgent: assignedAgentId || null,
      investmentInterest: investmentInterest || '',
      activityLog: [{
        action: 'Lead created',
        performedBy: req.user._id,
        timestamp: new Date()
      }]
    });
    
    if (assignedAgentId) {
      const io = req.app.get('socketio');
      io.to(assignedAgentId).emit('new_lead', { leadId: lead._id, name });
    }

    res.status(201).json(lead);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A lead with this phone number already exists.' });
    }
    console.error('Create lead error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDashboardStats = async (req: any, res: Response) => {
  try {
    const leads = await Lead.find({});
    
    const totalLeads = leads.length;
    const statusCounts: any = {};
    const agentCounts: any = {};
    let convertedCount = 0;

    leads.forEach((l: any) => {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      if (l.status === 'Converted') convertedCount++;
      if (l.assignedAgent) {
        const agentId = l.assignedAgent.toString();
        agentCounts[agentId] = (agentCounts[agentId] || 0) + 1;
      }
    });

    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({ _id: status, count }));
    
    const agents = await User.find({ role: 'agent' });
    const agentBreakdown = agents.map(agent => ({
      name: agent.name,
      count: agentCounts[agent._id.toString()] || 0
    }));

    const { start, end } = getUTCDayBounds(new Date());
    const statusUpdatesTodayAgg = await Lead.aggregate([
      { $unwind: { path: '$activityLog', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'activityLog.action': { $regex: /status updated/i },
          'activityLog.timestamp': { $gte: start, $lte: end }
        }
      },
      { $group: { _id: '$_id' } },
      { $count: 'count' }
    ]);
    const callsToday = statusUpdatesTodayAgg[0]?.count ?? 0;
    const overdueFollowUps = await Lead.countDocuments({
      nextFollowUpDate: { $ne: null, $lt: new Date() }
    });

    res.json({
      totalLeads,
      statusBreakdown,
      agentBreakdown,
      convertedCount,
      callsToday,
      overdueFollowUps
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteLead = async (req: any, res: Response) => {
  const { id } = req.params;
  try {
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    await Lead.deleteOne({ _id: id });
    res.json({ message: 'Lead deleted', id });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const parseLeadIds = (leadIds: any): string[] => {
  if (!Array.isArray(leadIds)) return [];
  return leadIds.map((id) => String(id)).filter(Boolean);
};

export const bulkTransferLeads = async (req: any, res: Response) => {
  const { leadIds, agentId } = req.body;
  try {
    const ids = parseLeadIds(leadIds);
    if (ids.length === 0) return res.status(400).json({ message: 'No leadIds provided' });
    if (!agentId) return res.status(400).json({ message: 'agentId is required for transfer' });

    const io = req.app.get('socketio');

    const updated: any[] = [];
    for (const leadId of ids) {
      const lead = await Lead.findById(leadId);
      if (!lead) continue;

      const oldAgentId = lead.assignedAgent;
      lead.assignedAgent = agentId;
      lead.updatedAt = new Date();
      lead.activityLog.push({
        action: `Transfer`,
        performedBy: req.user._id,
        timestamp: new Date(),
        metadata: {
          fromAgent: oldAgentId,
          toAgent: agentId,
          reason: 'Bulk Transfer'
        }
      });

      await lead.save();
      io.to(agentId).emit('new_lead', { leadId: lead._id, name: lead.name });
      updated.push(lead);
    }

    res.json({ message: 'Bulk transfer complete', updatedCount: updated.length });
  } catch (error) {
    console.error('Bulk transfer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const bulkAssignLeads = async (req: any, res: Response) => {
  const { leadIds, agentId } = req.body;
  try {
    const ids = parseLeadIds(leadIds);
    if (ids.length === 0) return res.status(400).json({ message: 'No leadIds provided' });

    const manualAgentId = agentId || null;
    const io = req.app.get('socketio');

    const updated: any[] = [];
    let skippedAlreadyAssigned = 0;

    for (const leadId of ids) {
      const lead = await Lead.findById(leadId);
      if (!lead) continue;

      // Bulk assign only fills unassigned leads; use bulk transfer to move existing assignments.
      if (lead.assignedAgent) {
        skippedAlreadyAssigned++;
        continue;
      }

      // If agentId is provided, bypass round-robin. Otherwise use round-robin.
      const assignedAgentId = manualAgentId || await getNextRoundRobinAgentId();
      lead.assignedAgent = assignedAgentId || null;
      lead.updatedAt = new Date();
      lead.activityLog.push({
        action: assignedAgentId
          ? `Lead assigned to agent ${assignedAgentId} (bulk assign)`
          : 'Lead assignment attempted but no agents available (bulk assign)',
        performedBy: req.user._id,
        timestamp: new Date()
      });

      await lead.save();
      if (assignedAgentId) {
        io.to(assignedAgentId).emit('new_lead', { leadId: lead._id, name: lead.name });
      }
      updated.push(lead);
    }

    res.json({
      message: 'Bulk assign complete',
      updatedCount: updated.length,
      skippedAlreadyAssigned,
    });
  } catch (error) {
    console.error('Bulk assign error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const bulkDeleteLeads = async (req: any, res: Response) => {
  const { leadIds } = req.body;
  try {
    const ids = parseLeadIds(leadIds);
    if (ids.length === 0) return res.status(400).json({ message: 'No leadIds provided' });

    const result = await Lead.deleteMany({ _id: { $in: ids } });
    res.json({ message: 'Bulk delete complete', deletedCount: result.deletedCount || 0 });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const assignUnassignedLeadsEqually = async (req: any, res: Response) => {
  try {
    const unassignedLeads = await Lead.find({ assignedAgent: null });
    if (unassignedLeads.length === 0) {
      return res.json({ message: 'No unassigned leads found', assignedCount: 0 });
    }

    const agents = await User.find({ role: 'agent', isActive: true }).select('_id');
    if (agents.length === 0) return res.status(400).json({ message: 'No active agents found' });

    // Calculate smart scores for Weighted Allocation
    const agentScores = await Promise.all(agents.map(async (agent) => {
      const agentId = agent._id;
      
      const convertedCount = await Lead.countDocuments({ assignedAgent: agentId, status: 'Converted' });
      const totalAssigned = await Lead.countDocuments({ assignedAgent: agentId });
      const conversionRate = totalAssigned > 0 ? (convertedCount / totalAssigned) * 100 : 0;

      const payments = await Payment.aggregate([
        { $match: { agentId: agentId, status: 'Received' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      const paymentsCollected = payments.length > 0 ? payments[0].total : 0;

      const normConv = Math.min(conversionRate, 100) / 100;
      const normPay = Math.min(paymentsCollected, 100000) / 100000;

      const score = normConv * 0.55 + normPay * 0.45;
      
      return { agentId, score: Math.max(0.01, score) }; // base score 0.01
    }));

    const totalScore = agentScores.reduce((acc, item) => acc + item.score, 0);
    const allocations = agentScores.map(item => ({
      agentId: item.agentId,
      score: item.score,
      quota: Math.round((item.score / totalScore) * unassignedLeads.length)
    }));

    // Floor rounding corrections
    let allocatedCount = allocations.reduce((acc, a) => acc + a.quota, 0);
    while (allocatedCount < unassignedLeads.length) { allocations[0].quota++; allocatedCount++; }
    while (allocatedCount > unassignedLeads.length) { const a = allocations.find(a => a.quota > 0); if(a) { a.quota--; allocatedCount--; } else break; }

    const io = req.app.get('socketio');
    const updated: any[] = [];
    
    let leadIdx = 0;
    for (const alloc of allocations) {
      for (let i = 0; i < alloc.quota && leadIdx < unassignedLeads.length; i++) {
        const lead = unassignedLeads[leadIdx++];
        lead.assignedAgent = alloc.agentId as any;
        lead.updatedAt = new Date();
        lead.activityLog.push({
          action: `Lead assigned via Smart Allocation (score weight: ${alloc.score.toFixed(2)})`,
          performedBy: req.user._id,
          timestamp: new Date(),
          metadata: { toAgent: alloc.agentId, reason: 'Smart Distribution Allocation' }
        });

        await lead.save();
        io.to(alloc.agentId.toString()).emit('new_lead', { leadId: lead._id, name: lead.name });
        updated.push(lead);
      }
    }

    res.json({ message: 'Smart Assignment complete', assignedCount: updated.length, allocations });
  } catch (error) {
    console.error('Assign unassigned error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
