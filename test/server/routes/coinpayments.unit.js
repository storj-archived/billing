const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const stubPromise = require('sinon-stub-promise');
stubPromise(sinon);
const storj = require('storj-lib');
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

// describe('#coinpayments IPN router', function() {
//   const coinpayments = new CoinpaymentsRouter(routerOpts);
//   const testUser = new coinpayments.models.User({
//     _id: 'dylan@storj.io',
//     hashpass: storj.utils.sha256('password')
//   });
//
//   describe('@constructor', function() {
//     it('smoke test', function(done) {
//       expect(coinpayments).to.be.instanceOf(CoinpaymentsRouter);
//       expect(coinpayments.storage).to.be.instanceOf(Storage);
//       expect(coinpayments.mailer).to.be.instanceOf(Mailer);
//       expect(coinpayments.config).to.be.instanceOf(Config);
//       done();
//     });
//   });
//
//   describe('#handleIPN', function () {
//     it('should create credits when IPN request is received', function (done) {
//       const mockBody = require('../../_fixtures/coinpayments_req');
//       const request = httpMocks.createRequest({
//         method: 'POST',
//         url: '/coinpayments'
//       });
//
//       request.body = mockBody({
//         currency: 'STORJ',
//         status: 100
//       });
//       request.user = testUser;
//
//       const response = httpMocks.createResponse({
//         req: request,
//         eventEmitter: EventEmitter
//       });
//
//       const mockPaymentProcessor = new coinpayments.storage.models.PaymentProcessor({
//         name: 'COINPAYMENTS',
//         user: 'dylan@storj.io',
//         default: true,
//         rawData: [{ address: '1234' }],
//         created: Date.now()
//       })
//
//       const mockCredit = new coinpayments.storage.models.Credit({
//         paid: false,
//         invoiced_amount: 100,
//         paid_amount: 0,
//         type: 'automatic',
//         user: testUser,
//         payment_processor: 'COINPAYMENTS'
//       });
//
//       const _findPaymentProc = sandbox
//         .stub(coinpayments.storage.models.PaymentProcessor, 'findOne')
//         .returnsPromise()
//
//       _findPaymentProc.resolves(mockPaymentProcessor);
//
//       const _findOne = sandbox
//         .stub(coinpayments.storage.models.Credit, 'findOne')
//         .returnsPromise();
//       _findOne.resolves(mockCredit);
//
//       const _save = sandbox
//         .stub(coinpayments.models.Credit.prototype, 'save')
//         .returnsPromise();
//
//       _save.resolves(mockCredit)
//
//       const _log = sandbox
//         .spy(console, 'log')
//
//       response.on('end', function () {
//         const data = response._getData();
//         console.log('MOCK CREDIT: ', mockCredit);
//         expect(mockCredit.paid).to.equal(true);
//         done();
//       });
//
//       coinpayments.handleIPN(request, response);
//     });
//
//     it('should create credit if one is not found', function (done) {
//       sandbox.restore();
//
//       // const testRouter = new CoinpaymentsRouter(
//       //   require('../../_fixtures/router-opts')
//       // )
//
//       // function Credit (options) {
//       //   expect(options).to.eql({
//       //     paid: false,
//       //     invoiced_amount: 100,
//       //     paid_amount: 0,
//       //     type: 'automatic',
//       //     user: testUser,
//       //     payment_processor: 'COINPAYMENTS'
//       //   })
//       // }
//
//       // testRouter.storage = {
//       //   models: {
//       //     Credit: Credit
//       //   }
//       // }
//
//       // Credit.prototype.save = sandbox.stub().callsArgWith(0, null);
//
//       const mockBody = require('../../_fixtures/coinpayments_req');
//       const request = httpMocks.createRequest({
//         method: 'POST',
//         url: '/coinpayments'
//       });
//
//       request.body = mockBody({
//         status: 100,
//         currency: 'STORJ'
//       });
//
//       const response = httpMocks.createResponse({
//         req: request,
//         eventEmitter: EventEmitter
//       });
//
//       const mockPaymentProcessor = new coinpayments.storage.models.PaymentProcessor({
//         name: 'COINPAYMENTS',
//         user: 'dylan@storj.io',
//         default: true,
//         rawData: [{ address: '1234' }],
//         created: Date.now()
//       });
//
//       const _findOne = sandbox
//         .stub(coinpayments.storage.models.PaymentProcessor, 'findOne')
//         .returnsPromise();
//
//       _findOne.resolves(mockPaymentProcessor);
//
//       const _findOneCredit = sandbox
//         .stub(coinpayments.storage.models.Credit, 'findOne')
//         .returnsPromise();
//
//       _findOneCredit.resolves();
//
//       const _credit = sandbox
//         .stub(coinpayments.storage.models, 'Credit')
//
//       response.on('end', function () {
//         const data = response._getData();
//         console.log('data: ', data);
//         expect(response.statusCode).to.equal(201);
//         done();
//       });
//
//       coinpayments.handleIPN(request, response);
//     });
//   });
// });
