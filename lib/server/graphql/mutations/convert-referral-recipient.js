'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const { Credit, Marketing, Referral } = graphqlService.models;
const creditType = require('../types/credit');
const marketingType = require('../types/marketing');
const { CREDIT_TYPES } = require('../../../constants');
const referralType = require('../types/referral');
const convertReferralRecipient = {
  type: referralType,
  args: {
    marketingId: { type: graphql.GraphQLString },
    marketingLink: { type: graphql.GraphQLString },
    recipientEmail: { type: graphql.GraphQLString },
    creditId: { type: graphql.GraphQLString },
    creditDate: { type: graphql.GraphQLString }
  },
  resolve: function(_, args) {
    return new Promise((resolve, reject) => {
      Referral
        .findOne({ _id: referralId })
        .then((referral) => {
          if (referral) {
            const credit = {
              created: args.creditDate,
              _id: args.creditId
            };
            return referral.convert_recipient_signup(credit);
          }
          const marketing = {
            _id: args.marketingId,
            referralLink: args.marketingLink
          };
          Referral
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

module.exports = convertReferralRecipient;
