'use strict';

const stripe = require('../../vendor/stripe');
const constants = require('../../../constants');
const STRIPE_PLAN_ID = constants.STRIPE_PLAN_ID;
let stripeProcessor;

const stripeAdapter = {
  /**
   * setData - format `rawData` in terms of the
   * `User#PaymentProcessors[n]#data` array
   * @param rawData {Object}:
   *   + customer {Object}: stripe customer object
   *   (used to determine the billing cycle for the subscription)
   * @return {Array}
   */
  serializeData: function(rawData) {
    return [rawData];
  },

  /**
   * setData - format `rawData` in terms of the
   * `User#PaymentProcessors[n]#data` array
   * @param rawData {array}
   * @return {Object}
   */
  parseData: function(rawData) {
    return rawData[0];
  },
  /**
   * register - use stripe api to create customer
   * @param token {String}: credit card token returned from stripe api
   * (see https://stripe.com/docs/subscriptions/tutorial)
   * @param email {String}: email of user create customer for
   * @return {Promise}
   */
  register: function(token, email) {
    return new Promise((resolve, reject) => {
      stripe.customers.create({
        source: token,
        plan: STRIPE_PLAN_ID,
        email: email
      }, (err, customer) => {
        if (err) {
          return reject(new Error(err));
        }

        return resolve({
          customer: customer,
          billingDate: (new Date()).getDate()
        });
      });
    });
  },
  /**
   * delete - delete stripe customer
   * @param options {Object}:
   * @return {Promise}: resolves/rejects with an object with `status`
   * and `message` properties
   */
  delete: function() {
    return new Promise((resolve, reject) => {
      stripe.customers.del(stripeProcessor.data.customer.id,
          (err, confirmation) => {
            if (err) {
              return reject(new Error(err));
            }

            if (!confirmation.deleted) {
              return reject(new Error('stripe couldn\'t delete the customer'));
            }

            return resolve(null);
          });
    });
  },
  /**
   * cancel - cancel stripe subscription
   * @return {Promise}
   */
  cancel: function() {
    return new Promise((resolve, reject) => {
      const subscriptionId = stripeProcessor.data.customer.subscriptions.data[0].id;
      stripe.subscriptions.del(subscriptionId, (err, cancelledSubscription) => {
        if (err) {
          return reject(new Error(err));
        }

        if (cancelledSubscription.status !== 'cancelled') {
          return reject(new Error(
              'stripe couldn\'t cancel the subscription: ' + subscriptionId
          ));
        }

        return resolve();
      });
    });
  },
  /**
   * isSubscribed - returns true if the user has a subscription to
   * the stripe plan with id of `STRIPE_PLAN_ID`
   * @return {Boolean}
   */
  validate: function() {
    console.log('stripeProcessor validate: ', stripeProcessor);
    // TODO: verify with stripe that subscription/customer are still valid, etc.
    const subscriptions = stripeProcessor.data.customer.subscriptions;

    console.log("stripe payment processor info: ", subscriptions);

    if (subscriptions.length > 1) {
      // TODO: add actual error handling...
      console.log('subscription length > 1');
      return Promise.reject(new Error('customer has more than one stripe subscription!'));
    }

    if (subscriptions.length < 1) {
      console.warn('customer has no subscriptions!');
      return Promise.resolve(false);
    }

    if (subscriptions.data[0].plan.id !== STRIPE_PLAN_ID) {
      // TODO: add actual error handling...
      console.log('stripe plan id wrong');
      return Promise.reject(new Error('customer is subscribed to unknown plan!'));
    }

    // console.log('validate before return, isValid ');
    return Promise.resolve(true);
  },
  /**
   * addPaymentMethod - add a credit card to the users stripe customer
   * @param options {Object}:
   *   + data {String}: stripe credit card token
   *     (see https://stripe.com/docs/subscriptions/tutorial)
   *   + user {User}: the current `User` instance for the request
   * @return {Promise}: resolves/rejects with an object with `status`
   * and `message` properties
   */
  addPaymentMethod: function(token) {
    const customerId = stripeProcessor.data.customer.id;

    return new Promise((resolve, reject) => {
      stripe.customers.createSource(
        customerId,
        { source: token },
        function(err, card) {
          if(err) {
            console.log('Error adding payment method: ', err);
            return reject(err);
          }

          // retrieve customer
          stripe.customers.retrieve(customerId, function(err, customer) {
            stripeProcessor.data.customer = customer;
            return resolve(stripeProcessor.update(stripeProcessor));
          })

        }
      )
    });
  },
  /**
   * charge - add an inventory item to the subscription's current
   * billing cycle
   * (see https://stripe.com/docs/subscriptions/guide#adding-invoice-items)
   * @param options {Object}:
   *   + data {String}: stripe credit card token
   *     (see https://stripe.com/docs/subscriptions/tutorial)
   *   + user {User}: the current `User` instance for the request
   * @return {Promise}
   */
  charge: function(options) {
    throw new Error('stripe charge method not yet implemented');
  },
  defaultPaymentMethod: function() {
    if(stripeProcessor.data.customer.sources.data[0]){
      const source = stripeProcessor.data.customer.sources.data[0];
      console.log('SOURCE: ', stripeProcessor.data.customer.sources.data[0]);
      return {
        id: source.id,
        merchant: source.brand,
        lastFour: source.last4
      };
    }
    return null;
  },
  billingDate: function() {
    return stripeProcessor.data.billingDate;
  },

  paymentMethods: function() {
    return stripeProcessor.data.customer.sources.data;
  }

};

module.exports = function(paymentProcessor) {
  stripeProcessor = paymentProcessor;
  return stripeAdapter
}
