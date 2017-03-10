const GB = 1000000000;
const MS_TO_HOUR = 1000 * 60 * 60;
const STORAGE_DEBIT_TYPE = "storage";
const BANDWIDTH_DEBIT_TYPE = "bandwidth";

let storage, billingClient;

// Need indexes on bucketentries.frame and pointers.hash
// Otherwise these will run slow as hell.

const calculateUserAmountOwedForStorage = function(billingPeriodStart, billingPeriodEnd, gbHourPrice) {
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
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "user"
          }
        },
        {
          $unwind: {
            path: "$user"
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
            storedBytes: {$multiply: ["$gigabytes", GB]},
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
                        }
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
            _id: "$user._id",
            totalBillableAmount: {$sum: "$fileBillableAmount"}
          }
        },
        {
          $project: {
            _id: 0,
            amount: "$totalBillableAmount",
            storage: "$storedBytes",
            user: "$_id",
            type: {$literal: STORAGE_DEBIT_TYPE},
          }
        }
      ])
      .cursor({batchSize: 100, async: true})
      .exec()
      .then(cursor => {
        // console.log('batching storage debits...');
        const insertPromises = [];
        return new Promise((resolve, reject) => {
          cursor.on('data', (debit) => {
            console.log('storage debits received: ', debit);
            insertPromises.push(billingClient.createDebit(debit));
          });

          cursor.on('end', () => {
            // console.log('storage cursor ended...');
            Promise.all(insertPromises).then(() => {
              // console.log('storage debits done!');
              resolve(true)
            })
          })
        });
      });
};

const calculateUserAmountOwedForBandwidth = function(billingPeriodStart, billingPeriodEnd, perGbPrice) {
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
              },
              {
                clientId: {$exists: true}
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
            path: "$publicKeyId",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $group: {
            _id: {$ifNull: ["$publicKeyId.user", "$reporterId"]},
            size: {$sum: "$pointerData.size"}
          }
        },
        {
          $project: {
            _id: 0,
            amount: {
              $multiply: [perGbPrice, {$divide: ["$size", GB]}]
            },
            bandwidth: "$size",
            user: "$_id",
            type: {$literal: BANDWIDTH_DEBIT_TYPE},
          }
        }
      ])
      .cursor({batchSize: 100, async: true})
      .exec()
      .then(cursor => {
        // console.log('batching bandwidth debits...');
        const insertPromises = [];
        return new Promise((resolve, reject) => {
          cursor.on('data', (debit) => {
            console.log('bandwidth debits received: ', debit);
            insertPromises.push(billingClient.createDebit(debit));
          });

          cursor.on('end', () => {
            // console.log('bandwidth cursor ended...');
            Promise.all(insertPromises).then(() => {
              // console.log('bandwidth debits done!');
              resolve(true)
            })
          })
        });
      });
};

module.exports = function(_storage, _billingClient) {
  storage = _storage;
  billingClient = _billingClient;

  return {
    forBandwidth: calculateUserAmountOwedForBandwidth,
    forStorage: calculateUserAmountOwedForStorage
  }
};
