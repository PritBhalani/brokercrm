import { Request, Response } from 'express';
import { User, Lead, DailyReport, Payment } from '../models/Models.ts';

export const updateDailyReport = async (req: any, res: Response) => {
  try {
    const { freshTraders, tomorrowActiveClients, notes } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const agentId = req.user._id;

    const report = await DailyReport.findOneAndUpdate(
      { agentId, date: today },
      { 
        $set: { 
          freshTraders, 
          tomorrowActiveClients,
          notes
        } 
      },
      { new: true, upsert: true }
    );

    res.json(report);
  } catch (error) {
    console.error('Error updating daily report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDailyReport = async (req: Request, res: Response) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(todayStr + 'T00:00:00Z');
    const endOfDay = new Date(todayStr + 'T23:59:59Z');
    
    const startOfTomorrow = new Date(startOfDay);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);
    const endOfTomorrow = new Date(startOfTomorrow);
    endOfTomorrow.setUTCHours(23, 59, 59, 999);

    const agentsReport = await User.aggregate([
      { $match: { role: 'agent' } },
      
      // 1. Lookup assigned leads
      {
        $lookup: {
          from: 'leads',
          localField: '_id',
          foreignField: 'assignedAgent',
          as: 'leads'
        }
      },

      // 2. Lookup payments collected by agent today
      {
        $lookup: {
          from: 'payments',
          let: { agentId: '$_id' },
          pipeline: [
            { $match: { 
                $expr: { 
                  $and: [
                    { $eq: ['$agentId', '$$agentId'] },
                    { $gte: ['$date', startOfDay] },
                    { $lte: ['$date', endOfDay] }
                  ]
                }
            }}
          ],
          as: 'todaysPayments'
        }
      },

      // 3. Lookup today's DailyReport limits (manual entries)
      {
        $lookup: {
          from: 'dailyreports',
          let: { agentId: '$_id' },
          pipeline: [
            { $match: { 
                $expr: { 
                  $and: [
                    { $eq: ['$agentId', '$$agentId'] },
                    { $eq: ['$date', todayStr] }
                  ]
                }
            }}
          ],
          as: 'dailyReport'
        }
      },
      {
        $unwind: { path: '$dailyReport', preserveNullAndEmptyArrays: true }
      },

      // 4. Project initial mapped structures
      {
        $project: {
          agent: { _id: '$_id', name: '$name' },
          
          manualReport: { $ifNull: ['$dailyReport', null] },
          todaysPayments: 1,

          computedActiveClients: {
            $size: {
              $filter: {
                input: '$leads',
                as: 'lead',
                cond: { $eq: ['$$lead.isActiveClient', true] }
              }
            }
          },
          
          computedFreshTraders: {
            $size: {
              $filter: {
                input: '$leads',
                as: 'lead',
                cond: {
                  $and: [
                    { $eq: ['$$lead.isFreshTrader', true] },
                    { $gte: ['$$lead.readyForDate', startOfTomorrow] },
                    { $lte: ['$$lead.readyForDate', endOfTomorrow] }
                  ]
                }
              }
            }
          },

          computedTomorrowActive: {
            $size: {
              $filter: {
                input: '$leads',
                as: 'lead',
                cond: {
                  $or: [
                    { $eq: ['$$lead.isActiveClient', true] },
                    { 
                      $and: [
                        { $eq: ['$$lead.isFreshTrader', true] },
                        { $gte: ['$$lead.readyForDate', startOfTomorrow] },
                        { $lte: ['$$lead.readyForDate', endOfTomorrow] }
                      ]
                    }
                  ]
                }
              }
            }
          },

          totalClientsAssigned: { $size: '$leads' },
          
          clientsBoughtCount: {
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
                          as: 'trade',
                          cond: {
                            $and: [
                              { $eq: ['$$trade.type', 'buy'] },
                              { $gte: ['$$trade.date', startOfDay] },
                              { $lte: ['$$trade.date', endOfDay] }
                            ]
                          }
                        }
                      }
                    },
                    0
                  ]
                }
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

      // 5. Final projection mapped to Dashboard
      {
        $project: {
          _id: 0,
          agent: 1,
          date: todayStr,
          
          // Morning
          activeClientsMorning: '$computedActiveClients',
          
          // Trading
          totalClientsAssigned: 1,
          clientsBoughtCount: 1,
          clientsNotBoughtCount: { $subtract: ['$totalClientsAssigned', '$clientsBoughtCount'] },
          totalBuyQuantity: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$allTrades',
                    as: 'trade',
                    cond: {
                       $and: [
                         { $gte: ['$$trade.date', startOfDay] },
                         { $lte: ['$$trade.date', endOfDay] }
                       ]
                    }
                  }
                },
                as: 't',
                in: { $ifNull: ['$$t.buyQuantity', 0] }
              }
            }
          },

          // Payments tracked cleanly from standalone payments collection
          paymentsCollected: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$todaysPayments',
                    as: 'payment',
                    cond: { $eq: ['$$payment.status', 'Received'] }
                  }
                },
                as: 'p',
                in: { $ifNull: ['$$p.amount', 0] }
              }
            }
          },
          pendingPayments: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$todaysPayments',
                    as: 'payment',
                    cond: { $eq: ['$$payment.status', 'Pending'] }
                  }
                },
                as: 'p',
                in: { $ifNull: ['$$p.amount', 0] }
              }
            }
          },

          // End of Day logic explicitly mapped via override or computation
          freshTraders: {
             $cond: {
                if: { $and: [ { $ne: ['$manualReport', null] }, { $gt: ['$manualReport.freshTraders', 0] } ] },
                then: '$manualReport.freshTraders',
                else: '$computedFreshTraders'
             }
          },
          tomorrowActiveClients: {
             $cond: {
                if: { $and: [ { $ne: ['$manualReport', null] }, { $gt: ['$manualReport.tomorrowActiveClients', 0] } ] },
                then: '$manualReport.tomorrowActiveClients',
                else: '$computedTomorrowActive'
             }
          }
        }
      }
    ]);

    res.json(agentsReport);
  } catch (error) {
    console.error('Error fetching computed daily report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
