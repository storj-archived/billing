'use strict';

const graphql = require('graphql');
const graphqlService = requre('../index');
const { Credit, Referral } = graphqlService.models();
const creditType = require('../types/credit');
const { CREDIT_TYPES, PROMO_CODE } = require('../../../constants');

const issueSignupCredit = {
  type: creditType,
  args: {
    userId: { type: grapql.GraphQLString },
    userType: { type: graphql. GraphQLString }
  },
  resolve: function(_, args) {
    return new Promise((resolve, reject) => {
      console.log('creating credit for', userId, userType)
      const newCredit = new Credit({
        user: userId,
        type: CREDIT_TYPES.AUTOMATIC,
        promo_code: PROMO_CODE[args.userType],
        promo_amount: PROMO_AMOUNT[args.userType],
        promo_expires: PROMO_EXPIRES[args.userType]
      });

      newCredit
        .save()
        .then((credit) => resolve(credit))
        .catch((err) => reject(err));
    });
  }
};
