'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const referralType = require('../types/referral');
const Promise = require('bluebird');
const { Referral, Marketing } = graphqlService.models;

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
   graphqlService.currentUserId
     .then((userId) => {
       const promiseArray = [];

       args.emailList.forEach((email) => {
          const emailPromise = () => {
            return new Promise((resolve, reject) => {
              Marketing.findOne({ _id: args.marketingId })
                .then((marketing) => {
                  graphqlService
                    .sendReferralEmail(userId, email, marketing)
                    .then(() => Referral.create(marketing, email, 'email'))
                    .then((result) => resolve(result))
                    .catch((err) => {
                      return reject({
                        message: 'Failed to connect to mailer-service',
                        error: err.message,
                        email: email,
                        marketing: marketing
                      })
                    });
                  })
                })
             }
          promiseArray.push(emailPromise());
       });

       Promise.all(promiseArray.map(function(promise) {
         return promise.reflect();
       })).each(function(inspection) {
         if (inspection.isFulfilled()) {
           inspection.value();
           response.successes.push(inspection);
         } else {
           inspection.reason();
           response.failures.push(inspection);
         }
       })
       .then(() => {
         return response;
       });
   });
 }
};

module.exports = sendReferralEmails;
