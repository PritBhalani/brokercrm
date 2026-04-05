import { Request, Response } from 'express';
import { SystemSettings, Attendance, User, Lead, Payment, DailyTradeOffer } from '../models/Models.ts';
import mongoose from 'mongoose';

const DEFAULT_COLLECTION_LABELS = ['Prit', 'Abhay', 'Pradip'];

function parseCollectionLabels(body: unknown): { ok: true; labels: string[] } | { ok: false; message: string } {
  if (!Array.isArray(body)) return { ok: false, message: 'collectionAccountLabels must be an array' };
  const cleaned = [...new Set(body.map((x) => String(x).trim()).filter(Boolean))].slice(0, 50);
  if (cleaned.length === 0) return { ok: false, message: 'At least one collection account label is required' };
  if (cleaned.some((s) => s.length > 80)) return { ok: false, message: 'Each label must be 80 characters or less' };
  return { ok: true, labels: cleaned };
}

/** Admin: set named trade slots for the current UTC calendar day (e.g. Trade 1, Trade 2). */
export const setDailyTradeOffers = async (req: Request, res: Response) => {
  try {
    const { slots } = req.body as { slots?: unknown };
    if (!Array.isArray(slots)) {
      return res.status(400).json({ message: 'slots must be an array of strings' });
    }
    const cleaned = [...new Set(slots.map((s) => String(s).trim()).filter(Boolean))].slice(0, 25);
    const dayKey = new Date().toISOString().split('T')[0];
    const doc = await DailyTradeOffer.findOneAndUpdate(
      { dayKey },
      { $set: { slots: cleaned, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ dayKey, slots: doc.slots });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Settings
export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({
        isLocked: false,
        officeStartTime: '09:00',
        officeEndTime: '18:00',
        collectionAccountLabels: DEFAULT_COLLECTION_LABELS,
      });
    } else if (!settings.collectionAccountLabels?.length) {
      settings.collectionAccountLabels = DEFAULT_COLLECTION_LABELS;
      settings.updatedAt = new Date();
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { isLocked, officeStartTime, officeEndTime, collectionAccountLabels } = req.body;
    let settings = await SystemSettings.findOne();
    if (!settings) {
      let initialLabels = DEFAULT_COLLECTION_LABELS;
      if (collectionAccountLabels !== undefined) {
        const parsed = parseCollectionLabels(collectionAccountLabels);
        if (parsed.ok === false) return res.status(400).json({ message: parsed.message });
        initialLabels = parsed.labels;
      }
      settings = await SystemSettings.create({
        isLocked: isLocked ?? false,
        officeStartTime: officeStartTime ?? '09:00',
        officeEndTime: officeEndTime ?? '18:00',
        collectionAccountLabels: initialLabels,
      });
    } else {
      if (isLocked !== undefined) settings.isLocked = isLocked;
      if (officeStartTime !== undefined) settings.officeStartTime = officeStartTime;
      if (officeEndTime !== undefined) settings.officeEndTime = officeEndTime;
      if (collectionAccountLabels !== undefined) {
        const parsed = parseCollectionLabels(collectionAccountLabels);
        if (parsed.ok === false) return res.status(400).json({ message: parsed.message });
        settings.collectionAccountLabels = parsed.labels;
      }
      settings.updatedAt = new Date();
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Attendance
export const getAttendance = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query; 
    let filter: any = {};
    if (month && year) {
      const monthStr = String(month).padStart(2, '0');
      filter.date = new RegExp(`^${year}-${monthStr}`);
    }
    
    const records = await Attendance.find(filter).populate('userId', 'name email').sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Dashboard Stats
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const agentsStats = await User.aggregate([
      { $match: { role: 'agent' } },
      {
        $lookup: {
          from: 'leads',
          localField: '_id',
          foreignField: 'assignedAgent',
          as: 'leads'
        }
      },
      {
        $lookup: {
          from: 'payments',
          localField: '_id',
          foreignField: 'agentId',
          as: 'payments'
        }
      },
      {
        $project: {
          agent: { _id: '$_id', name: '$name' },
          activeClients: {
            $size: {
              $filter: {
                input: '$leads',
                as: 'lead',
                cond: { $eq: ['$$lead.isActiveClient', true] }
              }
            }
          },
          clientsWithTrade: {
            $size: {
              $filter: {
                input: '$leads',
                as: 'lead',
                cond: { $gt: [{ $size: { $ifNull: ['$$lead.trades', []] } }, 0] }
              }
            }
          },
          allTrades: {
            $reduce: {
              input: '$leads.trades',
              initialValue: [],
              in: { $concatArrays: ['$$value', { $ifNull: ['$$this', []] }] }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          agent: 1,
          activeClients: 1,
          clientsWithTrade: 1,
          totalBuyQuantity: {
            $sum: '$allTrades.buyQuantity'
          },
          pendingPayment: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$payments',
                    as: 'payment',
                    cond: { $eq: ['$$payment.status', 'Pending'] }
                  }
                },
                as: 'p',
                in: { $ifNull: ['$$p.amount', 0] }
              }
            }
          },
          receivedPayment: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$payments',
                    as: 'payment',
                    cond: { $eq: ['$$payment.status', 'Received'] }
                  }
                },
                as: 'p',
                in: { $ifNull: ['$$p.amount', 0] }
              }
            }
          }
        }
      }
    ]);

    // Global Monthly Collection
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    const monthlyCollectionAgg = await Payment.aggregate([
      {
        $match: {
          status: 'Received',
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const totalMonthlyCollection = monthlyCollectionAgg.length > 0 ? monthlyCollectionAgg[0].total : 0;

    res.json({
      agentsStats,
      totalMonthlyCollection
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAgentFullSummary = async (req: Request, res: Response) => {
  try {
    const agentId = new mongoose.Types.ObjectId(req.params.id);
    const agent = await User.findById(agentId);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    const todayStr = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(todayStr + 'T00:00:00Z');
    const endOfDay = new Date(todayStr + 'T23:59:59Z');

    const leads = await Lead.find({ assignedAgent: agentId }).lean();
    
    const boughtClients: any[] = [];
    const notBoughtClients: any[] = [];
    let tradesToday: any[] = [];

    leads.forEach(lead => {
      const leadTradesToday = lead.trades?.filter((t: any) => {
        const tDate = new Date(t.date);
        return tDate >= startOfDay && tDate <= endOfDay;
      }) || [];
      
      if (leadTradesToday.length > 0) {
        leadTradesToday.forEach((t: any) => {
           tradesToday.push({ ...t, leadName: lead.name, leadId: lead._id });
        });
        boughtClients.push(lead);
      } else {
        notBoughtClients.push(lead);
      }
    });

    const payments = await Payment.find({
      agentId,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).populate('leadId', 'name').lean();

    const paymentsReceived = payments.filter((p: any) => p.status === 'Received');
    const paymentsPending = payments.filter((p: any) => p.status === 'Pending');

    res.json({
      agent: { id: agent._id, name: agent.name },
      clientList: { bought: boughtClients, notBought: notBoughtClients },
      tradesToday,
      payments: { received: paymentsReceived, pending: paymentsPending }
    });

  } catch (error) {
    console.error('getAgentFullSummary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** All payments for admin: received vs pending, clearance expectations, collection UPI label. */
export const listPayments = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const filter: any = {};
    if (status === 'Pending' || status === 'Received') filter.status = status;

    const payments = await Payment.find(filter)
      .populate('leadId', 'name phone')
      .populate('agentId', 'name email')
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();

    res.json({ payments });
  } catch (err) {
    console.error('listPayments error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
