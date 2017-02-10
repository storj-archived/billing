'use strict';

const graphql = require('graphql');
const graphqlService = requre('../index');
const { Credit, Marketing, Referral } = graphqlService.models();
const creditType = require('../types/credit');
const { CREDIT_TYPES, PROMO_CODE } = require('../../../constants');

const convertReferralRecipient = {
  type: referralType,
  args: {
    referralId: { type: graphql.GraphQLString },
    credit: {
      type: graphql.GraphQLObjectType,
      name: 'Credit',
      fields: {
        _id: { type: graphql.GraphQLString },
        created: { type: graphql.GraphQLString }
      }
    }
  },
  resolve: function(_, args) {
    return new Promise((resolve, reject) => {
      Referral
        .findOne({ _id: referralId })
        .then((referral) => referral.convert_recipient_signup(credit))
        .then((referral) => resolve(referral))
    });
  }
};
