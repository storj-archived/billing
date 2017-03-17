'use strict';

const async = require('async');
const constants = require('../constants');
const REFERRAL_CREDIT_TYPE = constants.CREDIT_TYPES.AUTO;
const REFERRAL_SENDER_PROMO_CODE = constants.PROMO_CODE.REFERRAL_SENDER;
const REFERRAL_SENDER_PROMO_EXPIRE = constants.PROMO_EXPIRES.REFERRAL_SENDER;

let storage, billingClient;

const updateReferralWithSenderCreditData = function(referralId) {
  let senderCredit = db.credits.findOne({ promo_referral_id: referralId });
  let senderCreditId = senderCredit._id;
  let senderCreditDateCreated = senderCreditId.getTimestamp();

  return db.referrals.update(
    { _id: referralId },
    {
      'sender.credit': senderCreditId,
      'converted.recipient_billed': senderCreditDateCreated
    }
  );
};

const generateReferralCredits = function() {
  return storage.models.Referral
    .aggregate([
      // start in referrals and filter for have signup and no billed
      {
      	$match: {
          $and: [
            {
              "converted.recipient_signup": { $ne: null }
            },
            {
              "converted.recipient_billed": { $eq: null }
            }
      	  ]
      	}
      },
      // look up from credits just to make sure there are no associated credits
      // extra check
       {
      	$lookup: {
      		from: "credits",
      		localField: "sender.credit",
      		foreignField: "credits._id",
      		as: "senderCredits"
      	}
      },
      // modeling thing
      {
      	$project: {
      		_id: 0,
      		referralId: "$_id",
      		senderId: "$sender.id",
      		senderExistingCreditCount: { $size: "$senderCredits" },
      		senderAmountToCredit: "$sender.amount_to_credit",
      		senderCreditId: "$sender.credit",
      		recipientId: "$recipient.id",
      		recipientMinSpentRequirement: "$recipient.min_spent_requirement"
      	}
      },
      // make sure array is empty
      {
      	$match: {
      		"$senderExistingCreditCount": { $eq: 0 }
      	}
      },
      // look up from debits. // change: look up from total credits where
      // credit.paid_amount total >= min_paid_requirement
      {
      	$lookup: {
      		from: "credits",
      		localField: "recipientId",
      		foreignField: "credits.user",
      		as: "recipientCredits"
      	}
      },
      {
      	$unwind: {
          path: "$recipientCredits"
      	}
      },
      {
      	$group: {
      		_id: {
      		  referralId: "$referralId",
      		  senderId: "$senderId",
      		  senderAmountToCredit: "$senderAmountToCredit",
      		  senderCreditId: "$senderCreditId",
      		  recipientId: "$recipientId",
      		  recipientMinSpentRequirement: "$recipientMinSpentRequirement"
      		},
      		recipientSpentTotal: { $sum: "$recipientCredits.paid_amount" }
      	}
      },
      {
      	$match: {
      		"$recipientSpentTotal": { $gte: "$_id.recipientMinSpentRequirement" }
      	}
      },
      {
      	$project: {
      		user: "$_id.senderId",
      		promo_referral_id: "$_id.referralId",
      		promo_code: { $literal: REFERRAL_SENDER_PROMO_CODE },
      		promo_amount: "$_id.senderAmountToCredit",
      		promo_expires: { $literal: REFERRAL_SENDER_PROMO_EXPIRE },
      		type: { $literal: REFERRAL_CREDIT_TYPE }
      	}
      }
      ])
      .cursor({batchSize: 100, async: true})
      .exec()
      .then(cursor => {
        console.log('batching referral credits...');
        const queue = async.queue(function(credit, done) {
          billingClient.handleCreateCredit(credit).then(() => {
            return updateReferralWithSenderCreditData(credit.promo_referral_id);
          }).then(done);
        }, 3);
        cursor.on('data', (credit) => queue.push(credit))
        .on('end', () => console.log('Referral Sender Credit Creation Complete'));
      });
};

module.exports = function(_storage, _billingClient) {
  storage = _storage;
  billingClient = _billingClient;

  return generateReferralCredits;
};
