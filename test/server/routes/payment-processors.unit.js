const sinon = require('sinon');
const stubPromise = require('sinon-stub-promise');
stubPromise(sinon);
const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const Promise = require('bluebird');
const EventEmitter = require('events').EventEmitter;
const PaymentProcessorsRouter = require('../../../lib/server/routes/payment-processors');
const httpMocks = require('node-mocks-http');
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
    it('should ping addPaymentProcessor', (done) => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/pp/wallets',
        body: {
          processor: {
            name: constants.PAYMENT_PROCESSORS.COINPAYMENTS,
            default: true
          },
          data: {
            token: '1234'
          }
        }
      });

      req.user = 'dylan@storj.io';

      const res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      res.on('end', (data) => {
        console.log('#### DATA: ', res._getData());
        console.log('#### add payment processor #### ');
        done();
      });

      const mockProcessor = new PaymentProc.models.PaymentProcessor({
        user: 'dylan@storj.io',
        name: constants.PAYMENT_PROCESSORS.COINPAYMENTS,
        rawData: [],
        default: true
      });

      console.log('adapter: ', PaymentProc);

      const _register = sandbox
        .returnsPromise();

      _register.resolves(mockProcessor);
       const _addPaymentProc = sandbox.spy(PaymentProc, '_addPaymentProcessor');

      // call the method
      PaymentProc._addPaymentProcessor(req, res);
    });
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
