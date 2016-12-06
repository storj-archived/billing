// Currently assumes timestamps are provided as numbers (i.e. Unix/Epoch)
var calculateTimeRangeIntersectionLength = function(startTimeOne, endTimeOne, startTimeTwo, endTimeTwo) {
  assert(startTimeOne <= endTimeOne, "First time range start greater than end");
  assert(startTimeTwo <= endTimeTwo, "Second time range start greater than end");

  var timeRangesHaveOverlap = (startTimeOne <= endTimeTwo) & (endTimeOne >= startTimeTwo);
  if (!timeRangesHaveOverlap) {
    return 0;
  } else {
    var intersectionStart = Math.max(startTimeOne, startTimeTwo);
    var intersectionEnd = Math.min(endTimeOne, endTimeTwo);
    return (intersectionEnd - intersectionStart) + 1;
  }
};

var convertMilliseconds = function(constant) {
  return function(ms) {
    return ms / (1000 * constant);
  };
};

var secondsInHour = 60 * 60;
var convertMillisecondsToHours = convertMilliseconds(secondsInHour);

var convertBytes = function(constant) {
  return function(bytes) {
    return bytes / constant;
  };
};

var GB = 1000000000;
var convertBytesToGB = convertBytes(GB);

var calculateUserAmountOwedForStorage = function(userId, billingPeriodStart, billingPeriodEnd, gbHourPrice) {
  var billingPeriodStartMs = new Date(billingPeriodStart).getTime();
  var billingPeriodEndMs= new Date(billingPeriodEnd).getTime();

  var userFrameAndFileList = db.frames.aggregate([
    {
      $match: {
        user: userId
      }
    },
    {
      $project: {
        _id: 1,
        user: 1,
        size: 1,
        locked: 1,
        created:1
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
    }
    ]);

   var billableAmountPerFile = [];
   userFrameAndFileList.forEach(function(frame) {
     var fileCreatedTime = (frame.bucketEntry.created || frame.created).getTime();
     var fileRenewalTime = (frame.bucketEntry.renewal || new Date(billingPeriodEndMs)).getTime();
     var fileBillableHours = convertMillisecondsToHours(calculateTimeRangeIntersectionLength(
      fileCreatedTime,
      fileRenewalTime,
      billingPeriodStartMs,
      billingPeriodEndMs));

     var fileBillableAmount = gbHourPrice * convertBytesToGB(frame.size) * fileBillableHours;
     return billableAmountPerFile.push(fileBillableAmount);
   });

   var totalBillableAmount = billableAmountPerFile.reduce((a, b) => a + b);
   return totalBillableAmount;
};

var calculateUserAmountOwedForBandwidth = function(userId, billingPeriodStart, billingPeriodEnd, perGbPrice) {
  var userPublicKeys = [];
  db.publickeys.find({user: userId}).forEach(function(pubKey) {
    return userPublicKeys.push(pubKey._id);
  });

  var userBandwidthStats = db.exchangereports.aggregate([
     {
      $match: {
        $and: [
        {
          reporterId: {
            $in: userPublicKeys
          }
        },
        {
          exchangeResultMessage: "SHARD_DOWNLOADED"
        },
        {
         exchangeStart: { $gte: ISODate(billingPeriodStart), $lte: ISODate(billingPeriodEnd)}
        }
       ]
     }
   },
   {
    $project: {
      _id: 0,
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
    $group: {
      _id: null,
      size: { $sum: "$pointerData.size"}
    }
   },
   {
    $project: {
      _id: 0,
      billableAmount: {
        $multiply: [perGbPrice, { $divide: ["$size", GB] } ]
     }
    }
   }
  ]);

  var totalBillableAmount = [];
  userBandwidthStats.forEach(stats => totalBillableAmount.push(stats.billableAmount));
  return totalBillableAmount.reduce((a, b) => a + b);
};
