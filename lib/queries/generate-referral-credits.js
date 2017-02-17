'use strict';

const async = require('async');
const constants = require('../../constants');
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
       {
      	$lookup: {
      		from: "credits",
      		localField: "sender.credit",
      		foreignField: "credits._id",
      		as: "senderCredits"
      	}
      },
      {
      	$project: {
      		_id: 0,
      		referralId: _id,
      		senderId: "$sender.id",
      		senderExistingCreditCount: { $size: "$senderCredits" },
      		senderAmountToCredit: "$sender.amount_to_credit",
      		senderCreditId: "$sender.credit",
      		recipientId: "$recipient.id",
      		recipientMinBilledRequirement: "$recipient.min_billed_requirement"
      	}
      },
      {
      	$match: {
      		"$senderExistingCreditCount": { $eq: 0 }
      	}
      },
      {
      	$lookup: {
      		from: "debits",
      		localField: "recipientId",
      		foreignField: "debits.user",
      		as: "recipientDebits"
      	}
      },
      {
      	$unwind: {
          path: "$recipientDebits"
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
      		  recipientMinBilledRequirement: "$recipientMinBilledRequirement"
      		},
      		recipientBilledTotal: { $sum: "$recipientDebits.amount" }
      	}
      },
      {
      	$match: {
      		"$recipientBilledTotal": { $gte: "$_id.recipientMinBilledRequirement" }
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
          billingClient.createCredit(credit).then(() => {
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
