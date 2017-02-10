'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const referralType = require('../types/referral');
const { Referral } = graphqlService.models();

const sendReferralEmails = {
  type: referralType,
  args: {
    marketingId: { type: graphql.GraphQLString },
    emailList: { type: new graphql.GraphQLList(graphql.GraphQLString) },
    senderEmail: { type: graphql.GraphQLString }
  },
  resolve: function(_, args) {
    console.log('in referral emails')
    // arg: emails, sender
    // add referral doc for each email
    // send email for each email
    return graphqlService.currentUserId
      .then((userId) => {
        console.log('user', userId)
        const referralPromises = args.emailList.map((email) => {
        graphqlService
          .sendReferralEmail(userId, email)
          .then(() => Referral.create(args.marketingId, email, 'email'))
          .catch(() => 'Failed to send to', email);

        Promise
          .all(referralPromises)
          .then((referrals) => console.log('referrals, referrals', referrals))
          .catch((err) => )

      });
    })
  }
};

module.exports = sendReferralEmails;
