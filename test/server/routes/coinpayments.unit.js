const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const stubPromise = require('sinon-stub-promise');
stubPromise(sinon);
const proxyquire = require('proxyquire');
const axios = require('axios');
const storj = require('storj-lib');
const constants = require('../../../lib/constants');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const Config = require('../../../lib/config');
const CoinpaymentsRouter = require('../../../lib/server/routes/coinpayments');
const ReadableStream = require('stream').Readable;
const errors = require('storj-service-error-types');
const routerOpts = require('../../_fixtures/router-opts');
const Mailer = require('storj-service-mailer');
const Storage = require('storj-service-storage-models');
const defaults = require('../../../lib/config.js').DEFAULTS;
const mailer = new Mailer(defaults.mailer);
const Promise = require('bluebird');

let sandbox;

beforeEach(function() {
  sandbox = sinon.sandbox.create();
});

afterEach(function() {
  sandbox.restore();
});

describe('#coinpayments IPN router', function() {
  const coinpayments = new CoinpaymentsRouter(routerOpts);
  const testUser = new coinpayments.models.User({
    _id: 'dylan@storj.io',
    hashpass: storj.utils.sha256('password')
  });

  describe('@constructor', function() {
    it('smoke test', function(done) {
      expect(coinpayments).to.be.instanceOf(CoinpaymentsRouter);
      expect(coinpayments.storage).to.be.instanceOf(Storage);
      expect(coinpayments.mailer).to.be.instanceOf(Mailer);
      expect(coinpayments.config).to.be.instanceOf(Config);
      done();
    });
  });

  describe('#_currentPrice', function () {
    it('should return current price', function (done) {
      const resolved = new Promise((r) => r({ data: { USD: 100.00 }}))
      sandbox.stub(axios, 'get').returns(resolved);

      coinpayments._currentPrice()
        .then((price) => {
          expect(price).to.be.ok;
          expect(price).to.be.a('Number');
          expect(price).to.equal(100.00);
          done();
        });
    });

    it('should return fallback price if api is down', function (done) {
      const resolved = new Promise((r) => r(undefined));
      sandbox.stub(axios, 'get').returns(resolved);
      coinpayments._currentPrice()
        .then((price) => {
          expect(price).to.be.ok;
          expect(price).to.be.a('Number');
          expect(price).to.equal(constants.STORJ_FALLBACK_PRICE);
          done();
        });
    });

    it('should return fallback price if err', function (done) {
      const rejected = new Promise((_, err) => r(err));
      sandbox.stub(axios, 'get').returns(rejected);

      coinpayments._currentPrice()
        .then((price) => {
          expect(price).to.equal(constants.STORJ_FALLBACK_PRICE);
          done();
        });
    });
  });

  describe('#handleIPN', function () {
    it('should create credits with paid=true when status=100', function (done) {
      const mockBody = require('../../_fixtures/coinpayments_req');
      const request = httpMocks.createRequest({
        method: 'POST',
        url: '/coinpayments'
      });

      request.body = mockBody({
        currency: 'STORJ',
        status: '100',
        amount: '1000'
      });

      request.user = testUser;

      const response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      const mockPaymentProcessor = new coinpayments.storage.models.PaymentProcessor({
        name: 'COINPAYMENTS',
        user: 'dylan@storj.io',
        default: true,
        created: Date.now()
      });

      const mockCredit = new coinpayments.storage.models.Credit({
        invoiced_amount: 1000,
        paid_amount: 1000,
        type: 'automatic',
        user: testUser._id,
        payment_processor: 'COINPAYMENTS'
      });

      const _findPaymentProc = sandbox
        .stub(coinpayments.storage.models.PaymentProcessor, 'findOne')
        .returnsPromise()

      _findPaymentProc.resolves(mockPaymentProcessor);

      const _findOne = sandbox
        .stub(coinpayments.storage.models.Credit, 'findOne')
        .returnsPromise();
      _findOne.resolves(mockCredit);

      const _save = sandbox
        .stub(coinpayments.models.Credit.prototype, 'save')
        .returnsPromise();

      _save.resolves(mockCredit)

      response.on('end', function () {
        const data = response._getData();
        expect(mockCredit.user).to.equal(testUser._id);
        expect(mockCredit.paid).to.equal(true);
        done();
      });

      coinpayments.handleIPN(request, response);
    });

    it('should create credit if one is not found', function (done) {
      const mockBody = require('../../_fixtures/coinpayments_req');
      const request = httpMocks.createRequest({
        method: 'POST',
        url: '/coinpayments'
      });

      request.body = mockBody({
        currency: 'STORJ',
        status: '100',
        amount: '1000'
      });

      request.user = testUser;

      const response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      const mockPaymentProcessor = new coinpayments.storage.models.PaymentProcessor({
        name: 'COINPAYMENTS',
        user: 'dylan@storj.io',
        default: true,
        created: Date.now()
      });

      const mockCredit = new coinpayments.storage.models.Credit({
        invoiced_amount: 1000,
        type: 'automatic',
        user: testUser._id,
        payment_processor: 'COINPAYMENTS'
      });

      const _findPaymentProc = sandbox
        .stub(coinpayments.storage.models.PaymentProcessor, 'findOne')
        .returnsPromise()

      _findPaymentProc.resolves(mockPaymentProcessor);

      const _findOne = sandbox
        .stub(coinpayments.storage.models.Credit, 'findOne')
        .returnsPromise();
      _findOne.resolves(undefined);

      const _save = sandbox
        .stub(coinpayments.models.Credit.prototype, 'save')
        .returnsPromise();

      _save.resolves(mockCredit);

      response.on('end', function () {
        const data = response._getData();
        expect(data).to.equal('Created');
        done();
      });

      coinpayments.handleIPN(request, response);
    });

    it('should create pending credits when status !== 100', function (done) {
      const mockBody = require('../../_fixtures/coinpayments_req');
      const request = httpMocks.createRequest({
        method: 'POST',
        url: '/coinpayments'
      });

      request.body = mockBody({
        currency: 'STORJ',
        status: '0',
        amount: '1000'
      });

      request.user = testUser;

      const response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      const mockPaymentProcessor = new coinpayments.storage.models.PaymentProcessor({
        name: 'COINPAYMENTS',
        user: 'dylan@storj.io',
        default: true,
        created: Date.now()
      });

      const mockCredit = new coinpayments.storage.models.Credit({
        invoiced_amount: 1000,
        type: 'automatic',
        user: testUser._id,
        payment_processor: 'COINPAYMENTS'
      });

      const _findPaymentProc = sandbox
        .stub(coinpayments.storage.models.PaymentProcessor, 'findOne')
        .returnsPromise()

      _findPaymentProc.resolves(mockPaymentProcessor);

      const _findOne = sandbox
        .stub(coinpayments.storage.models.Credit, 'findOne')
        .returnsPromise();
      _findOne.resolves(mockCredit);

      const _save = sandbox
        .stub(coinpayments.models.Credit.prototype, 'save')
        .returnsPromise();

      _save.resolves(mockCredit)

      response.on('end', function () {
        const data = response._getData();
        expect(mockCredit.user).to.equal(testUser._id);
        expect(mockCredit.paid).to.equal(false);
        expect(mockCredit.paid_amount).to.equal(0);
        done();
      });

      coinpayments.handleIPN(request, response);
    });

    it('should return 500 if incorrect currency', function (done) {
      const mockBody = require('../../_fixtures/coinpayments_req');
      const request = httpMocks.createRequest({
        method: 'POST',
        url: '/coinpayments'
      });

      request.body = mockBody({
        currency: 'ETH',
        status: '100',
        amount: '1000'
      });

      const response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      response.on('end', function () {
        const data = response._getData();
        expect(data.statusCode).to.equal(501);
        expect(data.message).to.equal('ethereum payments not supported at this time.');
        done();
      });

      coinpayments.handleIPN(request, response);
    });

    it('should return 500 if incorrect currency', function (done) {
      const mockBody = require('../../_fixtures/coinpayments_req');
      const request = httpMocks.createRequest({
        method: 'POST',
        url: '/coinpayments'
      });

      request.body = mockBody({
        currency: 'BTC',
        status: '100',
        amount: '1000'
      });

      const response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      response.on('end', function () {
        const data = response._getData();
        expect(data.statusCode).to.equal(501);
        expect(data.message).to.equal('bitcoin payments not supported at this time.');
        done();
      });

      coinpayments.handleIPN(request, response);
    });

		it('should error when no payment processor is found', function (done) {
			const mockBody = require('../../_fixtures/coinpayments_req');
			const request = httpMocks.createRequest({
				method: 'POST',
				url: '/coinpayments'
			});

			request.body = mockBody({
				currency: 'STORJ',
				status: '100'
			});

			const response = httpMocks.createResponse({
				req: request,
				eventEmitter: EventEmitter
			});

			const _findPaymentProc = sandbox
        .stub(coinpayments.storage.models.PaymentProcessor, 'findOne')
        .returnsPromise()

      _findPaymentProc.resolves(undefined);

			response.on('end', function () {
				expect(response._getData()).to.be.instanceOf(Error);
				expect(response._getData().statusCode).to.equal(400);
				expect(response._getData().message).to.equal('no user found');
				done();
			});

			coinpayments.handleIPN(request, response);
		});

  });
});
