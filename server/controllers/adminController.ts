import { Request, Response } from 'express';
import { SystemSettings, getSingletonSystemSettings, Attendance, User, Lead, Payment, DailyTradeOffer } from '../models/Models.ts';
import mongoose from 'mongoose';

function parseCollectionLabels(body: unknown): { ok: true; labels: string[] } | { ok: false; message: string } {
  if (!Array.isArray(body)) return { ok: false, message: 'collectionAccountLabels must be an array' };
  const cleaned = [...new Set(body.map((x) => String(x).trim()).filter(Boolean))].slice(0, 50);
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
    let settings = await getSingletonSystemSettings();
    if (!settings) {
      settings = await SystemSettings.create({
        isLocked: false,
        officeStartTime: '09:00',
        officeEndTime: '18:00',
        collectionAccountLabels: [],
      });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { isLocked, officeStartTime, officeEndTime, collectionAccountLabels } = req.body;
    let settings = await getSingletonSystemSettings();
    if (!settings) {
      let initialLabels: string[] = [];
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
      return res.json(settings);
    }

    const $set: Record<string, unknown> = { updatedAt: new Date() };
    if (isLocked !== undefined) $set.isLocked = isLocked;
    if (officeStartTime !== undefined) $set.officeStartTime = officeStartTime;
    if (officeEndTime !== undefined) $set.officeEndTime = officeEndTime;
    if (collectionAccountLabels !== undefined) {
      const parsed = parseCollectionLabels(collectionAccountLabels);
      if (parsed.ok === false) return res.status(400).json({ message: parsed.message });
      $set.collectionAccountLabels = parsed.labels;
    }

    const updated = await SystemSettings.findByIdAndUpdate(
      settings._id,
      { $set },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(updated);
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

/** UTC calendar bounds (aligned with daily trade offers / server UTC). */
function utcDayRange(now = new Date()): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, d, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
  };
}

function utcMonthRange(now = new Date()): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
  };
}

function parseStatsPeriod(req: Request): {
  period: 'all' | 'day' | 'month';
  rangeStart: Date | null;
  rangeEnd: Date | null;
  periodLabel: string;
} {
  const raw = String(req.query.period ?? 'all').toLowerCase();
  if (raw === 'day') {
    const { start, end } = utcDayRange();
    const key = new Date().toISOString().split('T')[0];
    return { period: 'day', rangeStart: start, rangeEnd: end, periodLabel: `Today (${key} UTC)` };
  }
  if (raw === 'month') {
    const { start, end } = utcMonthRange();
    const label = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return { period: 'month', rangeStart: start, rangeEnd: end, periodLabel: `${label} (UTC)` };
  }
  return { period: 'all', rangeStart: null, rangeEnd: null, periodLabel: 'All time' };
}

const agentStatsPipelineAllTime = [
  { $match: { role: 'agent' } },
  {
    $lookup: {
      from: 'leads',
      localField: '_id',
      foreignField: 'assignedAgent',
      as: 'leads',
    },
  },
  {
    $lookup: {
      from: 'payments',
      let: {
        agentId: '$_id',
        myLeadIds: { $map: { input: '$leads', as: 'l', in: '$$l._id' } },
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $or: [
                {
                  $and: [
                    { $eq: ['$agentId', '$$agentId'] },
                    {
                      $or: [{ $eq: ['$status', 'Pending'] }, { $eq: ['$status', 'Received'] }],
                    },
                  ],
                },
                {
                  $and: [
                    { $eq: ['$status', 'Pending'] },
                    { $in: ['$leadId', '$$myLeadIds'] },
                  ],
                },
                {
                  $and: [
                    { $eq: ['$status', 'Received'] },
                    { $in: ['$leadId', '$$myLeadIds'] },
                  ],
                },
              ],
            },
          },
        },
      ],
      as: 'payments',
    },
  },
  {
    $project: {
      agent: { _id: '$_id', name: '$name' },
      activeClients: {
        $size: {
          $filter: {
            input: '$leads',
            as: 'lead',
            cond: { $eq: ['$$lead.isActiveClient', true] },
          },
        },
      },
      clientsWithTrade: {
        $size: {
          $filter: {
            input: '$leads',
            as: 'lead',
            cond: { $gt: [{ $size: { $ifNull: ['$$lead.trades', []] } }, 0] },
          },
        },
      },
      allTrades: {
        $reduce: {
          input: '$leads.trades',
          initialValue: [],
          in: { $concatArrays: ['$$value', { $ifNull: ['$$this', []] }] },
        },
      },
      payments: 1,
    },
  },
  {
    $project: {
      _id: 0,
      agent: 1,
      activeClients: 1,
      clientsWithTrade: 1,
      totalBuyQuantity: { $sum: '$allTrades.buyQuantity' },
      pendingPayment: {
        $sum: {
          $map: {
            input: {
              $filter: {
                input: '$payments',
                as: 'payment',
                cond: { $eq: ['$$payment.status', 'Pending'] },
              },
            },
            as: 'p',
            in: { $ifNull: ['$$p.amount', 0] },
          },
        },
      },
      receivedPayment: {
        $sum: {
          $map: {
            input: {
              $filter: {
                input: '$payments',
                as: 'payment',
                cond: { $eq: ['$$payment.status', 'Received'] },
              },
            },
            as: 'p',
            in: { $ifNull: ['$$p.amount', 0] },
          },
        },
      },
    },
  },
];

function agentStatsPipelineForRange(rangeStart: Date, rangeEnd: Date) {
  return [
    { $match: { role: 'agent' } },
    {
      $lookup: {
        from: 'leads',
        localField: '_id',
        foreignField: 'assignedAgent',
        as: 'leads',
      },
    },
    {
      $lookup: {
        from: 'payments',
        let: {
          agentId: '$_id',
          myLeadIds: { $map: { input: '$leads', as: 'l', in: '$$l._id' } },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  {
                    $and: [
                      { $eq: ['$agentId', '$$agentId'] },
                      {
                        $or: [
                          { $eq: ['$status', 'Pending'] },
                          {
                            $and: [
                              { $eq: ['$status', 'Received'] },
                              { $gte: ['$date', rangeStart] },
                              { $lte: ['$date', rangeEnd] },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    $and: [
                      { $eq: ['$status', 'Pending'] },
                      { $in: ['$leadId', '$$myLeadIds'] },
                    ],
                  },
                  {
                    $and: [
                      { $eq: ['$status', 'Received'] },
                      { $gte: ['$date', rangeStart] },
                      { $lte: ['$date', rangeEnd] },
                      { $in: ['$leadId', '$$myLeadIds'] },
                    ],
                  },
                ],
              },
            },
          },
        ],
        as: 'payments',
      },
    },
    {
      $project: {
        agent: { _id: '$_id', name: '$name' },
        activeClients: {
          $size: {
            $filter: {
              input: '$leads',
              as: 'lead',
              cond: { $eq: ['$$lead.isActiveClient', true] },
            },
          },
        },
        clientsWithTrade: {
          $size: {
            $filter: {
              input: '$leads',
              as: 'lead',
              cond: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ['$$lead.trades', []] },
                        as: 't',
                        cond: {
                          $and: [{ $gte: ['$$t.date', rangeStart] }, { $lte: ['$$t.date', rangeEnd] }],
                        },
                      },
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
        allTrades: {
          $reduce: {
            input: '$leads',
            initialValue: [],
            in: {
              $concatArrays: [
                '$$value',
                {
                  $filter: {
                    input: { $ifNull: ['$$this.trades', []] },
                    as: 't',
                    cond: {
                      $and: [{ $gte: ['$$t.date', rangeStart] }, { $lte: ['$$t.date', rangeEnd] }],
                    },
                  },
                },
              ],
            },
          },
        },
        payments: 1,
      },
    },
    {
      $project: {
        _id: 0,
        agent: 1,
        activeClients: 1,
        clientsWithTrade: 1,
        totalBuyQuantity: { $sum: '$allTrades.buyQuantity' },
        pendingPayment: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$payments',
                  as: 'payment',
                  cond: { $eq: ['$$payment.status', 'Pending'] },
                },
              },
              as: 'p',
              in: { $ifNull: ['$$p.amount', 0] },
            },
          },
        },
        receivedPayment: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$payments',
                  as: 'payment',
                  cond: { $eq: ['$$payment.status', 'Received'] },
                },
              },
              as: 'p',
              in: { $ifNull: ['$$p.amount', 0] },
            },
          },
        },
      },
    },
  ];
}

// Dashboard Stats
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { period, rangeStart, rangeEnd, periodLabel } = parseStatsPeriod(req);

    const agentsStats =
      period === 'all'
        ? await User.aggregate(agentStatsPipelineAllTime)
        : await User.aggregate(agentStatsPipelineForRange(rangeStart!, rangeEnd!));

    const revenueMatch: Record<string, unknown> = { status: 'Received' };
    if (rangeStart && rangeEnd) {
      revenueMatch.date = { $gte: rangeStart, $lte: rangeEnd };
    }

    const revenueAgg = await Payment.aggregate([
      { $match: revenueMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalRevenueInPeriod = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    res.json({
      agentsStats,
      totalRevenueInPeriod,
      totalMonthlyCollection: totalRevenueInPeriod,
      period,
      periodLabel,
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
    const startOfTomorrow = new Date(startOfDay);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);
    const endOfTomorrow = new Date(startOfTomorrow);
    endOfTomorrow.setUTCHours(23, 59, 59, 999);

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

    const assignedLeadIds = leads.map((l: any) => l._id);

    /** Received + Pending: today's UTC window only (Command Center / drilldown). Lead-attributed rows included. */
    const paymentsRaw = await Payment.find({
      $and: [
        {
          $or: [{ agentId }, { leadId: { $in: assignedLeadIds } }],
        },
        {
          $or: [
            { status: 'Pending', date: { $gte: startOfDay, $lte: endOfDay } },
            { status: 'Received', date: { $gte: startOfDay, $lte: endOfDay } },
          ],
        },
      ],
    }).lean();

    const payLeadIds = [...new Set(paymentsRaw.map((p: any) => p.leadId).filter(Boolean))];
    const payLeads =
      payLeadIds.length > 0
        ? await Lead.find({ _id: { $in: payLeadIds } })
            .select('name')
            .lean()
        : [];
    const payLeadById = new Map(payLeads.map((l: any) => [l._id.toString(), l]));

    /** Manual join: `.populate` sets `leadId` to null when the lead doc is missing, which breaks name + link. */
    const payments = paymentsRaw.map((p: any) => {
      const lid = p.leadId;
      const idStr = lid?.toString?.() ?? String(lid);
      const doc = payLeadById.get(idStr);
      return {
        ...p,
        leadId: doc
          ? { _id: lid, name: doc.name ?? '' }
          : lid
            ? { _id: lid, name: null }
            : null,
      };
    });

    const paymentsReceived = payments.filter((p: any) => p.status === 'Received');
    const paymentsPending = payments.filter((p: any) => p.status === 'Pending');

    /** Command Center expand row: active clients ∪ FT due today/tomorrow (UTC). */
    const pipelineLeads = leads.filter((lead: any) => {
      if (lead.isActiveClient) return true;
      if (!lead.isFreshTrader || !lead.readyForDate) return false;
      const rd = new Date(lead.readyForDate).getTime();
      const d0 = startOfDay.getTime();
      const d1 = endOfDay.getTime();
      const t0 = startOfTomorrow.getTime();
      const t1 = endOfTomorrow.getTime();
      return (rd >= d0 && rd <= d1) || (rd >= t0 && rd <= t1);
    });

    const pipelineIds = pipelineLeads.map((l: any) => l._id);
    const paymentsForPipeline =
      pipelineIds.length > 0
        ? await Payment.find({
            leadId: { $in: pipelineIds },
            $or: [
              { status: 'Pending' },
              { status: 'Received', date: { $gte: startOfDay, $lte: endOfDay } },
            ],
          }).lean()
        : [];

    const payByLead = new Map<string, { receivedToday: number; pendingOpen: number }>();
    for (const p of paymentsForPipeline) {
      const lid = p.leadId?.toString?.() ?? String(p.leadId);
      if (!lid) continue;
      if (!payByLead.has(lid)) payByLead.set(lid, { receivedToday: 0, pendingOpen: 0 });
      const agg = payByLead.get(lid)!;
      const amt = Number(p.amount) || 0;
      if (p.status === 'Pending') agg.pendingOpen += amt;
      else if (p.status === 'Received') agg.receivedToday += amt;
    }

    const pipelineClients = pipelineLeads
      .map((lead: any) => {
        let buyQtyToday = 0;
        for (const t of lead.trades || []) {
          const td = new Date(t.date).getTime();
          if (td < startOfDay.getTime() || td > endOfDay.getTime()) continue;
          if (String(t.type || 'buy').toLowerCase() !== 'buy') continue;
          buyQtyToday += Number(t.buyQuantity) || 0;
        }
        const tags: string[] = [];
        if (lead.isActiveClient) tags.push('Active');
        if (lead.isFreshTrader && lead.readyForDate) {
          const rd = new Date(lead.readyForDate).getTime();
          if (rd >= startOfDay.getTime() && rd <= endOfDay.getTime()) tags.push('FT today');
          if (rd >= startOfTomorrow.getTime() && rd <= endOfTomorrow.getTime()) tags.push('FT tomorrow');
        }
        const idStr = lead._id.toString();
        const agg = payByLead.get(idStr) ?? { receivedToday: 0, pendingOpen: 0 };
        return {
          _id: lead._id,
          name: lead.name,
          phone: lead.phone ?? '',
          tags,
          buyQtyToday,
          receivedToday: agg.receivedToday,
          pendingOpen: agg.pendingOpen,
        };
      })
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));

    res.json({
      agent: { id: agent._id, name: agent.name },
      clientList: { bought: boughtClients, notBought: notBoughtClients },
      tradesToday,
      payments: { received: paymentsReceived, pending: paymentsPending },
      pipelineClients,
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
    const agentId = req.query.agentId as string | undefined;
    const filter: any = {};
    if (status === 'Pending' || status === 'Received') filter.status = status;
    if (agentId && mongoose.Types.ObjectId.isValid(agentId)) {
      const oid = new mongoose.Types.ObjectId(agentId);
      const leadIdsForAgent = await Lead.find({ assignedAgent: oid }).distinct('_id');
      filter.$or = [{ agentId: oid }, { leadId: { $in: leadIdsForAgent } }];
    }

    const paymentsRaw = await Payment.find(filter).sort({ updatedAt: -1 }).limit(500).lean();

    const leadIds = [...new Set(paymentsRaw.map((p: any) => p.leadId).filter(Boolean))];
    const paymentAgentIds = [...new Set(paymentsRaw.map((p: any) => p.agentId).filter(Boolean))];

    const leadDocs =
      leadIds.length > 0
        ? await Lead.find({ _id: { $in: leadIds } })
            .select('name phone assignedAgent')
            .lean()
        : [];

    const assignedIds = [
      ...new Set(
        leadDocs
          .map((l: any) => l.assignedAgent)
          .filter(Boolean)
          .map((id: any) => id.toString())
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const allUserIds = [...new Set([...paymentAgentIds.map((id: any) => id.toString()), ...assignedIds.map((id) => id.toString())])].map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    const agentDocs =
      allUserIds.length > 0
        ? await User.find({ _id: { $in: allUserIds } })
            .select('name email')
            .lean()
        : [];

    const leadById = new Map<string, any>(
      leadDocs.map((l: any) => [l._id.toString(), l] as [string, any])
    );
    const agentById = new Map<string, any>(
      agentDocs.map((a: any) => [a._id.toString(), a] as [string, any])
    );

    /** Prefer lead owner (assigned agent) for display — matches how new payments store agentId. */
    const payments = paymentsRaw.map((p: any) => {
      const lid = p.leadId;
      const aid = p.agentId;
      const ldoc = lid ? leadById.get(lid.toString()) : undefined;
      const assignRaw = ldoc?.assignedAgent;
      const assignId =
        assignRaw && typeof assignRaw === 'object' && assignRaw !== null && '_id' in assignRaw
          ? (assignRaw as { _id: unknown })._id
          : assignRaw;
      const assignDoc = assignId ? agentById.get(String(assignId)) : undefined;
      const payDoc = aid ? agentById.get(aid.toString()) : undefined;
      const displayDoc = assignDoc ?? payDoc;
      const displayId = assignId ?? aid;
      return {
        ...p,
        leadId: ldoc
          ? { _id: lid, name: ldoc.name ?? '', phone: ldoc.phone ?? '' }
          : lid
            ? { _id: lid, name: null, phone: null }
            : null,
        agentId: displayDoc
          ? { _id: displayId, name: displayDoc.name ?? '', email: displayDoc.email ?? '' }
          : displayId
            ? { _id: displayId, name: null, email: null }
            : null,
      };
    });

    res.json({ payments });
  } catch (err) {
    console.error('listPayments error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
