'use strict';

const REFERRAL_CREDIT_TYPE = 'automatic';
const REFERRAL_PROMO_CODE = 'referral';

let storage, billingClient;

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
      }
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
      		promo_code: { $literal: REFERRAL_PROMO_CODE },
      		promo_amount: "$_id.senderAmountToCredit",
      		type: { $literal: REFERRAL_CREDIT_TYPE } 
      	}
      }
      ])
      .cursor({batchSize: 100, async: true})
      .exec()
      .then(cursor => {
        console.log('batching referral sender credits...');
        const insertPromises = [];
        return new Promise((resolve, reject) => {
          cursor.on('data', (credit) => {
            console.log('storage referral credit received: ', credit);
            insertPromises.push(billingClient.createCredit(credit));
          });

          cursor.on('end', () => {
            console.log('storage cursor ended...');
            Promise.all(insertPromises).then(() => {
              console.log('storage referral credit done!');
              resolve(true)
            })
          })
        });
      });
};

module.exports = function(_storage, _billingClient) {
  storage = _storage;
  billingClient = _billingClient;

  return generateReferralCredits;
};
