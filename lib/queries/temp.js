db.exchangereports.aggregate([
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
            $count: 'count'
          }
])
