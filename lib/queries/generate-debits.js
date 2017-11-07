const logger = require('../logger');
const GB = 1000000000;
const MS_TO_HOUR = 1000 * 60 * 60;
const STORAGE_DEBIT_TYPE = "storage";
const BANDWIDTH_DEBIT_TYPE = "bandwidth";

let storage, billingClient;

const calculateUserAmountOwedForStorage = function(billingPeriodStart, billingPeriodEnd, gbHourPrice) {
  const billingPeriodStartIsoDate = new Date(billingPeriodStart);
  const billingPeriodEndIsoDate = new Date(billingPeriodEnd);
  // For debit creation date, remove one second so we make sure to fall within the billing period
  // that we're working with currently
  const debitCreationIsoDate = new Date(billingPeriodEnd - 1);

  return storage.models.StorageEvent
    .aggregate([
    {
      $match: {
        $and: [
          {success: true},
          {storage: {$gt: 0}},
          {user: {$ne: null}}
        ]
      }
    },
    {
      $project: {
        _id: 0,
        user: 1,
        shardHash: 1,
        dateShardCreated: "$timestamp",
        dateShardDeleted: {$ifNull: [{$min: ["$farmerEnd", "$userDeleted"]}, {$add: [new Date(), 0]}]},
        shardSize: "$storage"
      }
    },
    {
      $project: {
        user: 1,
        shardHash: 1,
        shardSizeGb: {$divide: ["$shardSize", GB]},
        dateShardCreated: 1,
        dateShardDeleted: 1,
        shardHoursOverlapWithBillingPeriod: {
          $divide: [
            {$max: [0,
              {$add: [1,
                {$subtract: [
                  {$min: ["$dateShardDeleted", billingPeriodEndIsoDate]},
                  {$max: ["$dateShardCreated", billingPeriodStartIsoDate]}
                ]},
              ]},
            ]},
            MS_TO_HOUR]}
      }
    },
    {
      $project: {
        user: 1,
        shardHash: 1,
        shardGbHoursUsed: {$multiply: ["$shardSizeGb", "$shardHoursOverlapWithBillingPeriod"]},
        shardBillableAmount: {$multiply: ["$shardSizeGb", "$shardHoursOverlapWithBillingPeriod", gbHourPrice]}
      }
    },
    {
      $group: {
        _id: "$user",
        totalBillableAmount: {$sum: "$shardBillableAmount"},
        totalGbHoursUsed: {$sum: "$shardGbHoursUsed"}
      }
    },
    {
       $project: {
        _id: 0,
        amount: "$totalBillableAmount",
        storage: "$totalGbHoursUsed",
        user: "$_id",
        type: {$literal: STORAGE_DEBIT_TYPE},
        created: {$literal: debitCreationIsoDate}
      }
    }
    ])
    .cursor({batchSize: 100, async: true})
    .allowDiskUse(true)
    .read('secondaryPreferred')
    .exec()
    .then(cursor => {
      const insertPromises = [];
      return new Promise((resolve, reject) => {
        cursor.on('error', (err) => {
          logger.error(err);
          reject(err);
        });

        cursor.on('data', (debit) => {
          logger.debug('Storage debits received: ', debit);
          insertPromises.push(
            billingClient.createDebit(debit)
              .catch((err) => {
                logger.warn('error caught from billingClient.create:');
                logger.warn(`debit: ${JSON.stringify(debit)}`);
                logger.warn(`error: ${JSON.stringify(err)}`);
                // reject(err);

                /* TODO: record somewhere that this
                 * debit didn't get created
                 */

                resolve({error: err});
              })
          );
        });

        /* TODO: should we have our own timeout or something?
         * e.g. if *neither* the storage nor bandwidth aggregations'
         *      `cursor` `end` event handlers get called.
         */

        cursor.on('end', () => {
          Promise.all(insertPromises).then(() => {
            resolve(true)
          }).catch((err) => {
            logger.error(err);
            reject(err);
          });
        })
      });
    });
};

const calculateUserAmountOwedForBandwidth = function(billingPeriodStart, billingPeriodEnd, perGbPrice) {
  const billingPeriodStartIsoDate = new Date(billingPeriodStart);
  const billingPeriodEndIsoDate = new Date(billingPeriodEnd);
  // For debit creation date, remove one second so we make sure to fall within the billing period
  // that we're working with currently
  const debitCreationIsoDate = new Date(billingPeriodEnd - 1);

  return storage.models.StorageEvent
    .aggregate([
      {
        $match: {
          $and: [
            timestamp: {$gte: billingPeriodStartIsoDate, $lt: billingPeriodEndIsoDate},
            {success: true},
            {downloadBandwidth: {$gt: 0}}
          ]
        }
      },
      {
        $group: {
          _id: "$user",
          downloadBandwidthAmount: {$sum: "$downloadBandwidth"}
        }
      },
      {
        $project: {
          _id: 0,
          amount: {$multiply: [perGbPrice, {$divide: ["$downloadBandwidthAmount", GB]}]},
          bandwidth: "$downloadBandwidthAmount",
          user: "$_id",
          type: {$literal: BANDWIDTH_DEBIT_TYPE},
          created: {$literal: debitCreationIsoDate}
        }
      }
      ])
      .cursor({batchSize: 100, async: true})
      .allowDiskUse(true)
      .read('secondaryPreferred')
      .exec()
      .then(cursor => {
        const insertPromises = [];
        return new Promise((resolve, reject) => {
          cursor.on('error', (err) => {
            logger.error(err);
            reject(err);
          });

          cursor.on('data', (debit) => {
            logger.debug('bandwidth debits received: ', debit);
            insertPromises.push(
              billingClient.createDebit(debit)
                .catch((err) => {
                  logger.warn('error caught from billingClient.create:');
                  logger.warn(`debit: ${JSON.stringify(debit)}`);
                  logger.warn(`error: ${JSON.stringify(err)}`);
                  // reject(err);

                  /* TODO: record somewhere that this
                   * debit didn't get created
                   */

                  resolve({error: err});
                })
            );
          });

          /* TODO: should we have our own timeout or something?
           * e.g. if *neither* the storage nor bandwidth aggregations'
           *      `cursor` `end` event handlers get called.
           */

          cursor.on('end', () => {
            logger.debug('Starting insertPromises to billingClient');
            Promise.all(insertPromises).then(() => {
              resolve(true)
            }).catch((err) => {
              logger.error(err);
              reject(err);
            });
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
