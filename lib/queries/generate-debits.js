const GB = 1000000000;
const MS_TO_HOUR = 1000 * 60 * 60;
const STORAGE_DEBIT_TYPE = "storage";
const BANDWIDTH_DEBIT_TYPE = "bandwidth";

let storage, billingClient;

const calculateUserAmountOwedForStorage = function(billingPeriodStart, billingPeriodEnd, gbHourPrice) {
  const billingPeriodStartIsoDate = new Date(billingPeriodStart);
  const billingPeriodEndIsoDate = new Date(billingPeriodEnd);

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
        haveEntryCreationEvent: {$sum: {$cond: [{$eq: ["$operation", "Removal"]}, 1, 0]}},
        haveEntryRemovalEvent: {$sum: {$cond: [{$eq: ["$operation", "Creation"]}, 1, 0]}}
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
        entrySize: 1,
        entryBillableAmount: {$multiply: ["$entrySizeGb", "$entryHoursOverlapWithBillingPeriod", gbHourPrice]}
      }
    },
    {
      $group: {
        _id: "$userId",
        totalBillableAmount: {$sum: "$entryBillableAmount"},
        totalBytes: {$sum: "$entrySize"}
      }
    },
    {
       $project: {
        _id: 0,
        amount: "$totalBillableAmount",
        storage: "$totalBytes",
        user: "$_id",
        type: {$literal: STORAGE_DEBIT_TYPE},
      }
    }
    ])
    .cursor({batchSize: 100, async: true})
    .allowDiskUse(true)
    .exec()
    .then(cursor => {
      const insertPromises = [];
      return new Promise((resolve, reject) => {
        cursor.on('data', (debit) => {
          console.log('Storage debits received: ', debit);
          insertPromises.push(billingClient.createDebit(debit));
        });
        cursor.on('end', () => {
          Promise.all(insertPromises).then(() => {
            resolve(true)
          })
        })
      });
    });
};

const calculateUserAmountOwedForBandwidth = function(billingPeriodStart, billingPeriodEnd, perGbPrice) {
  const billingPeriodStartIsoDate = new Date(billingPeriodStart);
  const billingPeriodEndIsoDate = new Date(billingPeriodEnd);

  return storage.models.StorageEvent
    .aggregate([
      {
        $match: {
          timestamp: {$gte: billingPeriodStartIsoDate, $lte: billingPeriodEndIsoDate}
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
        }
      }
      ])
      .cursor({batchSize: 100, async: true})
      .allowDiskUse(true)
      .exec()
      .then(cursor => {
        const insertPromises = [];
        return new Promise((resolve, reject) => {
          cursor.on('data', (debit) => {
            console.log('bandwidth debits received: ', debit);
            insertPromises.push(billingClient.createDebit(debit));
          });
          cursor.on('end', () => {
            console.log('Starting insertPromises to billingClient');
            Promise.all(insertPromises).then(() => {
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
