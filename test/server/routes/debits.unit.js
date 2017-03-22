const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const stubPromise = require('sinon-stub-promise');
stubPromise(sinon);
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const Config = require('../../../lib/config');
const DebitsRouter = require('../../../lib/server/routes/debits');
const ReadableStream = require('stream').Readable;
const errors = require('storj-service-error-types');
const routerOpts = require('../../_fixtures/router-opts');

let sandbox;

beforeEach(function() {
  sandbox = sinon.sandbox.create();
});

afterEach(function() {
  sandbox.restore();
});

describe('#debitsRouter', function() {
  const debitsRouter = new DebitsRouter(routerOpts);

  describe('smoke test', function() {
    it('debitsRouter should exist with proper configs', function(done) {
      expect(debitsRouter).to.be.ok;
      expect(debitsRouter.storage).to.be.ok;
      expect(debitsRouter.models).to.be.ok;
      expect(debitsRouter.mailer).to.be.ok;
      expect(debitsRouter.contracts).to.be.ok;
      expect(debitsRouter.config).to.equal(routerOpts.config);
      done();
    });
  });

  describe('_create', function() {
    it('should create a debit and return the debit object', function(done) {
      var mockDebit = new debitsRouter.storage.models.Debit({
        amount: 666,
        user: 'lott.dylan@gmail.com',
        type: 'bandwidth',
        created: new Date()
      });

      var mockPaymentProcessor = new debitsRouter.storage.models.PaymentProcessor({
        user: "dylan@storj.io",
        name: "stripe",
        default: true
      });

      var req = httpMocks.createRequest({
        method: 'POST',
        url: '/debits',
        body: {
          user: "user@example.com",
          type: "bandwidth",
          amount: 123456,
          created: new Date()
        }
      });

      var res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      var _createDebit = sandbox
        .stub(debitsRouter.storage.models.Debit, 'create')
        .returnsPromise();

      _createDebit.resolves(mockDebit);

      var _findPaymentProc = sandbox
        .stub(debitsRouter.storage.models.PaymentProcessor, 'findOne')
        .returnsPromise();

      _findPaymentProc.resolves(mockPaymentProcessor);

      var _find = sandbox
        .stub(debitsRouter.storage.models.Debit, 'find')
        .returnsPromise();
      _find.resolves([mockDebit]);

      var _sync = sandbox
        .stub(mockPaymentProcessor.adapter, 'syncDebits')
        .returnsPromise();
      _sync.resolves();

      res.on('end', function() {
        const data = res._getData();
        expect(data).to.be.ok;
        expect(data).to.be.an('object');
        expect(data.debit).to.be.ok;
        expect(data.debit).to.be.an('object');
        expect(data.debit.amount).to.equal(mockDebit.amount);
        expect(data.debit.amount).to.be.a('number');
        expect(data.debit.storage).to.be.a('number');
        expect(data.debit.bandwidth).to.be.a('number');
        expect(data.debit.created).to.be.a('date');
        expect(data.debit.id).to.be.a('string');
        expect(data.debit.user).to.be.a('string');
      });

      debitsRouter.createDebit(req, res);
      done();
    });

  });

  describe('_error handling', function() {
    it('should return 400 error if no user', function(done) {
      var req = httpMocks.createRequest({
        method: 'POST',
        url: '/debits',
        body: {
          type: "bandwidth",
          amount: 123456,
          created: new Date()
        }
      });

      var res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      const _createSpy = sandbox.spy(debitsRouter.storage.models.Debit, 'create');

      res.on('end', function() {
        const data = res._getData();
        expect(res.statusCode).to.equal(400);
        expect(data).to.equal('Bad Request');
        expect(_createSpy.callCount).to.equal(0);
      });

      debitsRouter.createDebit(req, res);
      done();
    });

    it('should return 400 error if no amount', function(done) {
      var req = httpMocks.createRequest({
        method: 'POST',
        url: '/debits',
        body: {
          user: "dylan@storj.io",
          type: "bandwidth",
          created: new Date()
        }
      });

      var res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      const _createSpy = sandbox.spy(debitsRouter.storage.models.Debit, 'create');

      res.on('end', function() {
        const data = res._getData();
        expect(res.statusCode).to.equal(400);
        expect(data).to.equal('Bad Request');
        expect(_createSpy.callCount).to.equal(0);
      });

      debitsRouter.createDebit(req, res);
      done();
    });

    it('should return 500 if create debit fails', function(done) {
      var mockDebit = new debitsRouter.storage.models.Debit({
        amount: 666,
        user: 'lott.dylan@gmail.com',
        type: 'bandwidth',
        created: new Date()
      });

      var mockPaymentProcessor = new debitsRouter.storage.models.PaymentProcessor({
        user: "dylan@storj.io",
        name: "stripe",
        default: true
      });

      var req = httpMocks.createRequest({
        method: 'POST',
        url: '/debits',
        body: mockDebit
      });

      var res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      var _createDebit = sandbox
        .stub(debitsRouter.storage.models.Debit, 'create')
        .returnsPromise();

      const err = new errors.InternalError('Panic!');
      _createDebit.rejects(err);

      res.on('end', function(){
        const data = res._getData();
        expect(data.error).to.be.ok;
        expect(data.error.statusCode).to.equal(500);
        expect(data.error.message).to.equal('Panic!');
      })

      debitsRouter.createDebit(req, res);
      done();
    });
  });


});
