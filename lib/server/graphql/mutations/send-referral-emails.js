'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const referralType = require('../types/referral');
const bluebird = require('bluebird');
const { Referral } = graphqlService.models;

const sendReferralEmails = {
  type: referralType,
  args: {
    marketingId: { type: graphql.GraphQLString },
    emailList: { type: new graphql.GraphQLList(graphql.GraphQLString) },
    senderEmail: { type: graphql.GraphQLString }
  },
  resolve: function(_, args) {
    // arg: emails, sender
    // add referral doc for each email
    // send email for each email
    const response = {
      failures: [],
      successes: []
    }
    return graphqlService.currentUserId
      .then((userId) => {
        const referralPromises = args.emailList.map((email) => {
        graphqlService
          .sendReferralEmail(userId, email)
          .then(() => Referral.create(args.marketingId, email, 'email'))
          .catch(() => 'Failed to send to', email);

        Promise
          .all(referralPromises)
          .then((referrals) => console.log('referrals, referrals', referrals))
          .catch((err) => console.error(err));
      });
    })
  }
};

module.exports = sendReferralEmails;
