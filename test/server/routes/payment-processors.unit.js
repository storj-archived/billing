const sinon = require('sinon');
const stubPromise = require('sinon-stub-promise');
const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const Promise = require('bluebird');


stubPromise(sinon);

const PaymentProcessorsRouter = require('../../../lib/server/routes/payment-processors');
const errors = require('storj-service-error-types');
const routerOpts = require('../../_fixtures/router-opts');
const constants = require('../../../lib/constants');
const Config = require('../../../lib/config');

describe('PaymentProcessors Router', () => {
  const PaymentProc = new PaymentProcessorsRouter(routerOpts);
  let sandbox;

  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    done();
  });

  afterEach((done) => {
    sandbox.restore();
    done();
  });

  describe('@constructor', () => {
    it('smoke test', (done) => {
      expect(PaymentProc.config).to.be.instanceOf(Config);
      expect(PaymentProc).to.be.instanceOf(PaymentProcessorsRouter);
      expect(PaymentProc.models).to.be.ok;
      done();
    });
  });

  describe('#_addPaymentProcessor', () => {

  });

  describe('#_setUserFreeTier', () => {

  });

  describe('#addPaymentMethod', () => {

  });

  describe('#handleCreateAddress', () => {

  });

  describe('#getWallets', () => {

  });

  describe('#removePaymentMethod', () => {

  });

  describe('#getDefaultPP', () => {

  });

  describe('#handleIPN', () => {

  });

  describe('#_createCoinPaymentsCredit', () => {

  });

});
