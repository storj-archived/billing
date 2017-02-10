'use strict';

const graphql = require('graphql');
const graphqlService = requre('../index');
const { Credit, Marketing, Referral } = graphqlService.models();
const creditType = require('../types/credit');
const marketingType = require('../types/marketing');
const { CREDIT_TYPES } = require('../../../constants');

const convertReferralRecipient = {
  type: referralType,
  args: {
    marketing: marketingType,
    recipientEmail: { type: graphql.GraphQLString },
    credit: creditType
  },
  resolve: function(_, args) {
    return new Promise((resolve, reject) => {
      Referral
        .findOne({ _id: referralId })
        .then((referral) => {
          if (referral) {
            return referral.convert_recipient_signup(credit);
          }
          return Referral
            .create(marketing, recipientEmail, 'link')
            .then((referral) => {
              return referral.convert_recipient_signup(args.credit);
            })
            .then((referral) => resolve(referral));
        })
        .then((referral) => resolve(referral))
    });
  }
};
