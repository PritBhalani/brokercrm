import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './server/models/Models.ts';

dotenv.config();

async function test() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error('Set MONGODB_URI in .env (e.g. Atlas connection string).');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const todayStr = new Date().toISOString().split('T')[0];
  const startOfDay = new Date(todayStr + 'T00:00:00Z');
  const endOfDay = new Date(todayStr + 'T23:59:59Z');

  try {
    const agentsReport = await User.aggregate([
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
      {
        $project: {
          agent: { _id: '$_id', name: '$name' },
          
          manualFields: {
             activeClientsMorning: { $ifNull: ['$dailyReport.activeClientsMorning', 0] },
             freshTraders: { $ifNull: ['$dailyReport.freshTraders', 0] },
             tomorrowActiveClients: { $ifNull: ['$dailyReport.tomorrowActiveClients', 0] },
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
              input: { $ifNull: ['$leads.trades', []] },
              initialValue: [],
              in: { $concatArrays: ['$$value', { $ifNull: ['$$this', []] }] }
            }
          },

          followups: {
            noAnswer: {
              $size: {
                $filter: {
                  input: '$leads',
                  as: 'lead',
                  cond: {
                    $and: [
                      { $eq: ['$$lead.status', 'noAnswer'] },
                      { $gte: ['$$lead.updatedAt', startOfDay] },
                      { $lte: ['$$lead.updatedAt', endOfDay] }
                    ]
                  }
                }
              }
            },
            callLater: {
              $size: {
                $filter: {
                  input: '$leads',
                  as: 'lead',
                  cond: {
                    $and: [
                      { $eq: ['$$lead.status', 'callLater'] },
                      { $gte: ['$$lead.updatedAt', startOfDay] },
                      { $lte: ['$$lead.updatedAt', endOfDay] }
                    ]
                  }
                }
              }
            },
            interested: {
               $size: {
                $filter: {
                  input: '$leads',
                  as: 'lead',
                  cond: {
                    $and: [
                      { $eq: ['$$lead.status', 'interested'] },
                      { $gte: ['$$lead.updatedAt', startOfDay] },
                      { $lte: ['$$lead.updatedAt', endOfDay] }
                    ]
                  }
                }
              }
            },
            notInterested: {
               $size: {
                $filter: {
                  input: '$leads',
                  as: 'lead',
                  cond: {
                    $and: [
                      { $eq: ['$$lead.status', 'notInterested'] },
                      { $gte: ['$$lead.updatedAt', startOfDay] },
                      { $lte: ['$$lead.updatedAt', endOfDay] }
                    ]
                  }
                }
              }
            },
            capitalIssue: {
               $size: {
                $filter: {
                  input: '$leads',
                  as: 'lead',
                  cond: {
                    $and: [
                      { $eq: ['$$lead.status', 'capitalIssue'] },
                      { $gte: ['$$lead.updatedAt', startOfDay] },
                      { $lte: ['$$lead.updatedAt', endOfDay] }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          agent: 1,
          date: todayStr,
          activeClientsMorning: '$manualFields.activeClientsMorning',
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
          paymentsCollected: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$allTrades',
                    as: 'trade',
                    cond: { 
                      $and: [
                         { $eq: ['$$trade.status', 'Received'] },
                         { $gte: ['$$trade.date', startOfDay] },
                         { $lte: ['$$trade.date', endOfDay] }
                      ]
                    }
                  }
                },
                as: 't',
                in: { $ifNull: ['$$t.commission', 0] }
              }
            }
          },
          pendingPayments: {
             $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$allTrades',
                    as: 'trade',
                    cond: { $eq: ['$$trade.status', 'Pending'] }
                  }
                },
                as: 't',
                in: { $ifNull: ['$$t.commission', 0] }
              }
            }
          },
          followups: 1,
          freshTraders: '$manualFields.freshTraders',
          tomorrowActiveClients: '$manualFields.tomorrowActiveClients',
        }
      }
    ]);
    console.log("SUCCESS:", agentsReport);
  } catch (e) {
    console.log("FAIL:", e);
  }
  process.exit();
}

test();
