const logger = require('../logger');
const GB = 1000000000;
const MS_TO_HOUR = 1000 * 60 * 60;
const STORAGE_DEBIT_TYPE = "storage";
const BANDWIDTH_DEBIT_TYPE = "bandwidth";

let storage, billingClient;

const sum = function () {
  return storage.models.User.aggregate([
		{
				$project: {
						_id: 1
				}
		},
		{
		 $lookup: {
			 from: "credits",
			 localField: "_id",
			 foreignField: "user",
			 as: "credits"
			}
		}, {
			$lookup: {
			 from: "debits",
			 localField: "_id",
			 foreignField: "user",
			 as: "debits"
			}
		},
		{
				$project: {
						_id: 1,
						creditSum: { $sum: "$credits.paid_amount" },
						promoSum: { $sum: "$credits.promo_amount" },
						debitSum: { $sum: "$debits.amount" }
				}
		},
		{
				$project: {
						_id: 1,
						amountOwed: { $subtract: [ "$debitSum", {
								$add:["$creditSum", "$promoSum"]
						}]}
				}
		}
	])
}

module.exports = function(_storage, _billingClient) {
  storage = _storage;
  billingClient = _billingClient;

  return {
    getAmount
  }
}
