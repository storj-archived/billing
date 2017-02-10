'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const { Marketing } = graphqlService.models;
const ReferralType = require('../types/credit');

const CreditsQuery = {
  type: ReferralType,
  args: {
    referralLink: { type: graphql.GraphQLString }
  },
  resolve: function(_, args) {
    return new Promise((resolve, reject) => {
      Marketing
        .isValidReferralLink(args.referralLink)
        .then((link) => resolve(link))
        .catch((err) => reject(err));
    });
  }
};

module.exports = CreditsQuery;
