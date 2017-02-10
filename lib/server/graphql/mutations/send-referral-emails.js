'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const referralType = require('../types/referral');
const bluebird = require('bluebird');

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
    const response = {
      failures: [],
      successes: []
    }
    return graphqlService.currentUserId
      .then((userId) => {
        console.log('user mailer', userId)
        const referralPromises = args.emailList.map((email) => {
          graphqlService.sendReferralEmail(userId, email)
          .then(() => {
            console.log('creating referral')
            return graphqlService.models.Referral.create(args.marketingId, email, 'email');
          })
          .catch((err) => {
            console.log('err sendReferralEmail: ', err);
            return 'failed';
          })

          bluebird.all(referralPromises.map(function(promise) {
            return bluebird.reflect();
          })).then(function(result) {
            console.log('promise.all result: ', result);
            result.filter(function(email) {
              console.log('result.filter email: ', email);
              if(email.isFulfilled()) {
                response.successes.push(email);
              } else {
                response.failures.push(email);
              }
            });
            console.log(response);
            return Promise.resolve(response);
          });
      });
    })
  }
};

module.exports = sendReferralEmails;
