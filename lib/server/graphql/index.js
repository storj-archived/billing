'use strict';

/**
 * Singleton object for graphql things.
 */

const graphql = require('graphql');

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
  /**
   * currentUser - (async) looks up user based on
   * current request's `x-pubkey` header
   * @return promise {Promise}: mongoose `User.findOne` promise
   */
  get currentUser() {
    if (!_models) {
      return Promise.reject(new Error('graphql schema hasn\'t processed any requests!'));
    }

    const publicKeyHeader = _lastRequest.header('x-pubkey');
    if (!publicKeyHeader) {
      return Promise.reject({status: 'error', message: 'Request not authenticated via ECDSA.'});
    }

    return this.models.PublicKey.findOne({_id: publicKeyHeader})
        .then((publicKey)=> {
          console.log('current user: ', publicKey.user);
          return this.models.User.findOne({_id: publicKey.user});
        })
        .catch(() => {
          console.log('current user never found');
        });
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
