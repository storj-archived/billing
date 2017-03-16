const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const Config = require('../../../lib/config');
const DebitsRouter = require('../../../lib/server/routes/debits');
const ReadableStream = require('stream').Readable;
const errors = require('storj-service-error-types');
const routerOpts = require('../../_fixtures/router-opts');

describe('Debits Router', function() {

  const debitsRouter = new DebitsRouter(routerOpts);

  describe('smoke test', function()  {

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

});
