const GB = 1000000000;
const MS_TO_HOUR = 1000 * 60 * 60;
const STORAGE_DEBIT_TYPE = "storage";
const BANDWIDTH_DEBIT_TYPE = "bandwidth";
const Aggregate = require('mongoose/lib/aggregate');

// Need indexes on bucketentries.frame and pointers.hash
// Otherwise these will run slow as hell.

const calculateUserAmountOwedForStorage = function(storage) {
  return function(billingPeriodStart, billingPeriodEnd, gbHourPrice) {
    const billingPeriodStartIsoDate = new Date(billingPeriodStart);
    const billingPeriodEndIsoDate = new Date(billingPeriodEnd);

    return storage.models.Frame
        .aggregate([
          {
            $project: {
              _id: 1,
              user: 1,
              size: 1,
              created: 1
            }
          },
          {
            $lookup: {
              from: "bucketentries",
              localField: "_id",
              foreignField: "frame",
              as: "bucketEntry"
            }
          },
          {
            $unwind: {
              path: "$bucketEntry"
            }
          },
          {
            $project: {
              _id: 1,
              user: 1,
              gigabytes: {$divide: ["$size", GB]},
              fileCreatedTime: {
                $ifNull: ["$bucketEntry.created", "$created"]
              },
              fileRenewalTime: {
                $ifNull: ["$bucketEntry.renewal", billingPeriodEndIsoDate]
              }
            }
          },
          {
            $match: {
              $and: [
                {
                  "fileCreatedTime": {$lte: billingPeriodEndIsoDate}
                },
                {
                  "fileRenewalTime": {$gte: billingPeriodStartIsoDate}
                }
              ]
            }
          },
          {
            $project: {
              _id: 1,
              user: 1,
              fileBillableAmount: {
                $multiply: [
                  gbHourPrice,
                  "$gigabytes",
                  {
                    $divide: [
                      {
                        $add: [
                          1,
                          {
                            $subtract: [
                              {$min: ["$fileRenewalTime", billingPeriodEndIsoDate]},
                              {$max: ["$fileCreatedTime", billingPeriodStartIsoDate]}
                            ]
                          },
                        ]
                      },
                      MS_TO_HOUR
                    ]
                  }
                ]
              }
            }
          },
          {
            $group: {
              _id: "$user",
              totalBillableAmount: {$sum: "$fileBillableAmount"}
            }
          },
          {
            $project: {
              _id: 0,
              amount: "$totalBillableAmount",
              user: "$_id",
              type: {$literal: STORAGE_DEBIT_TYPE}
            }
          }
        ])
        .cursor({batchSize: 100, async: true})
        .exec()
        .then(cursor => {
          console.log('batching storage debits...');
          const insertPromises = [];
          return new Promise((resolve, reject) => {
            cursor.on('data', (data) => {
              console.log('storage debits received: ', data);
              insertPromises.push(storage.models.Debit.create(data));
            });

            cursor.on('end', () => {
              console.log('storage cursor ended...');
              Promise.all(insertPromises).then(() => {
                console.log('storage debits done!');
                resolve(true)
              })
            })
          });
        });
  }
};

const calculateUserAmountOwedForBandwidth = function(storage) {
  return function(billingPeriodStart, billingPeriodEnd, perGbPrice) {
    const billingPeriodStartIsoDate = new Date(billingPeriodStart);
    const billingPeriodEndIsoDate = new Date(billingPeriodEnd);

    return storage.models.ExchangeReport
        .aggregate([
          {
            $match: {
              $and: [
                {
                  exchangeResultMessage: "SHARD_DOWNLOADED"
                },
                {
                  exchangeStart: {$gte: billingPeriodStartIsoDate, $lte: billingPeriodEndIsoDate}
                }
              ]
            }
          },
          {
            $project: {
              _id: 0,
              reporterId: 1,
              dataHash: 1
            }
          },
          {
            $lookup: {
              from: "pointers",
              localField: "dataHash",
              foreignField: "hash",
              as: "pointerData"
            }
          },
          {
            $unwind: {
              path: "$pointerData"
            }
          },
          {
            $lookup: {
              from: "publickeys",
              localField: "reporterId",
              foreignField: "_id",
              as: "publicKeyId"
            }
          },
          {
            $unwind: {
              path: "$publicKeyId"
            }
          },
          {
            $group: {
              _id: "$publicKeyId.user",
              size: {$sum: "$pointerData.size"}
            }
          },
          {
            $project: {
              _id: 0,
              amount: {
                $multiply: [perGbPrice, {$divide: ["$size", GB]}]
              },
              user: "$_id",
              type: {$literal: BANDWIDTH_DEBIT_TYPE}
            }
          }
        ])
        .cursor({batchSize: 500, async: true})
        .exec()
        .then(cursor => {
          console.log('batching bandwidth debits...');
          const insertPromises = [];
          return new Promise((resolve, reject) => {
            cursor.on('data', (data) => {
              console.log('bandwidth debits received: ', data);
              insertPromises.push(storage.models.Debit.create(data));
            });

            cursor.on('end', () => {
              console.log('bandwidth cursor ended...');
              Promise.all(insertPromises).then(() => {
                console.log('bandwidth debits done!');
                resolve(true)
              })
            })
          });
        });
  }
};

module.exports = function(storage) {
  return {
    forBandwidth: calculateUserAmountOwedForBandwidth(storage),
    forStorage: calculateUserAmountOwedForStorage(storage)
  }
};
