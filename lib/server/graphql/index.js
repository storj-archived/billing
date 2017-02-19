'use strict';

/**
 * Singleton object for graphql things.
 */

const graphql = require('graphql');
const StorjMailer = require('storj-service-mailer');
const defaults = require('../../config.js').DEFAULTS;
const mailer = new StorjMailer(defaults.mailer);
const Promise = require('bluebird');

let _schema;
let _models;
let _lastRequest;

module.exports = {
  bindSchema: function(boundModels) {
    _models = boundModels;
    // console.log('graphQL STORAGE is : %j', Object.keys(_models));

    const rootQuery = require('./queries');
    const rootMutation = require('./mutations');
    _schema = new graphql.GraphQLSchema({
      query: rootQuery,
      mutation: rootMutation
    });
    _schema.middleware = (req, res, next) => {
      _lastRequest = req;
      next();
    };

    return this.schema;
  },
  addPaymentProcessor: function(name, data) {
    if (!_models) {
      return Promise.reject(new Error('graphql schema hasn\'t processed any requests!'));
    }

    const publicKeyHeader = _lastRequest.header('x-pubkey');
    if (!publicKeyHeader) {
      return Promise.reject({status: 'error', message: 'Request not authenticated via ECDSA.'});
    }

    return this.models.PublicKey.findOne({_id: publicKeyHeader})
      .then((publicKey)=> {
        const user = publicKey.user;
        const paymentProcessor = new this.models.PaymentProcessor({
          user: user,
          name: name,
          // TODO: don't assume default
          default: true
        });

        return paymentProcessor.adapter
          .register(data, user)
          .then((data) => {
            paymentProcessor.data = data;
            return paymentProcessor.save();
          })
      })
      .catch(e => {
        console.error(`Unhandled exception in \`addPaymentProcessor\`: ${e}`);
        console.error(e.stack);
      });
  },
  sendReferralEmail: function(senderEmail, recipientEmail, marketing) {
    console.log('sendReferralEmail: ', senderEmail, 'Sending to: ', recipientEmail, 'Marketing: ', marketing);
    return new Promise((resolve, reject) => {
      mailer.dispatch(recipientEmail, 'referral', {
        url: 'https://app.storj.io/#/signup?referralLink=' + marketing.referralLink,
        senderEmail: senderEmail
      }, function(err) {
        if (err) {
          console.error('Error sendReferralEmail: ', err);
          return reject(err);
        }
        console.log('Mailer dispatch: ', recipientEmail, senderEmail);
        return resolve(true);
      });
    });
  },
  get schema() {
    if (!_schema) {
      throw new Error('graphql schema hasn\'t been initialized yet!');
    }

    return _schema;
  },
  get models() {
    if (!_models) {
      throw new Error('graphql schema hasn\'t been initialized with models!');
    }

    return _models;
  },
  get currentUserId() {
    if (!_models) {
      return Promise.reject(new Error('graphql schema hasn\'t processed any requests!'));
    }

    const publicKeyHeader = _lastRequest.header('x-pubkey');
    if (!publicKeyHeader) {
      return Promise.reject({status: 'error', message: 'Request not authenticated via ECDSA.'});
    }

    return this.models.PublicKey.findOne({_id: publicKeyHeader})
        .then((publicKey) => {
          console.log('publicKey user', publicKey.user);
          return publicKey.user
        })
        .catch(() => {
          console.log('current user never found');
        });
  },
  /**
   * currentUser - (async) looks up user based on
   * current request's `x-pubkey` header
   * @return promise {Promise}: mongoose `User.findOne` promise
   */
  get currentUser() {
    return this.currentUserId
      .then((userId) => this.models.User.findOne({ _id: userId }))
      .catch((err) => console.error(err));
  },
  get defaultPaymentProcessor() {
    if (!_models) {
      return Promise.reject(new Error('graphql schema hasn\'t processed any requests!'));
    }

    const publicKeyHeader = _lastRequest.header('x-pubkey');
    if (!publicKeyHeader) {
      return Promise.reject({status: 'error', message: 'Request not authenticated via ECDSA.'});
    }

    return this.models.PublicKey.findOne({_id: publicKeyHeader})
      .then((publicKey) => {
        return this.models.PaymentProcessor.findOne({user: publicKey.user, default: true});
      });
  }
};
