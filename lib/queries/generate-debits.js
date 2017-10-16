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
          {downloadBandwidth: 0},
          {storage: {$ne: 0}}
        ]
      }
    },
    {
      $project: {
        _id: 0,
        user: 1,
        timestamp: 1,
        bucketEntry: 1,
        storage: 1,
        operation: {$cond: [{$lt: ["$storage", 0]}, "Removal", "Creation"]}
      }
    },
    {
      $group: {
        _id: {
          user: "$user",
          entry: "$bucketEntry"
        },
        minEventTimestamp: {$min: "$timestamp"},
        maxEventTimestamp: {$max: "$timestamp"},
        entrySize: {$max: {$abs: "$storage"}},
        haveEntryCreationEvent: {$sum: {$cond: [{$eq: ["$operation", "Creation"]}, 1, 0]}},
        haveEntryRemovalEvent: {$sum: {$cond: [{$eq: ["$operation", "Removal"]}, 1, 0]}}
      }
    },
    {
      $project: {
        _id: 0,
        userId: "$_id.user",
        entryId: "$_id.entry",
        dateEntryCreated: {
          $cond: [
            {$eq: ["$haveEntryCreationEvent", 0]},
            billingPeriodStartIsoDate,
            "$minEventTimestamp"
          ]
        },
        dateEntryDeleted: {
          $cond: [
            {$eq: ["$haveEntryRemovalEvent", 0]},
            {$add: [new Date(), 0]},
            "$maxEventTimestamp"
          ]
        },
        entrySize: 1
      }
    },
    {
      $project: {
        userId: 1,
        entryId: 1,
        entrySize: 1,
        entrySizeGb: {$divide: ["$entrySize", GB]},
        dateEntryCreated: 1,
        dateEntryDeleted: 1,
        entryHoursOverlapWithBillingPeriod: {
          $divide: [
            {$max: [0,
              {$add: [1,
                {$subtract: [
                  {$min: ["$dateEntryDeleted", billingPeriodEndIsoDate]},
                  {$max: ["$dateEntryCreated", billingPeriodStartIsoDate]}
                ]},
              ]},
            ]},
            MS_TO_HOUR]}
      }
    },
    {
      $project: {
        userId: 1,
        entryId: 1,
        entryGbHoursUsed: {$multiply: ["$entrySizeGb", "$entryHoursOverlapWithBillingPeriod"]},
        entryBillableAmount: {$multiply: ["$entrySizeGb", "$entryHoursOverlapWithBillingPeriod", gbHourPrice]}
      }
    },
    {
      $group: {
        _id: "$userId",
        totalBillableAmount: {$sum: "$entryBillableAmount"},
        totalGbHoursUsed: {$sum: "$entryGbHoursUsed"}
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
          timestamp: {$gte: billingPeriodStartIsoDate, $lt: billingPeriodEndIsoDate}
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
