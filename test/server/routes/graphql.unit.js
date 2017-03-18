const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
require('sinon-as-promised');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const Config = require('../../../lib/config');
const GraphQLRouter = require('../../../lib/server/routes/graphql');
const ReadableStream = require('stream').Readable;
const errors = require('storj-service-error-types');
const routerOpts = require('../../_fixtures/router-opts');
const middleware = require('storj-service-middleware');
const graphqlHTTP = require('express-graphql');
let sandbox;

beforeEach(() => {
  sandbox = sinon.sandbox.create();
});

afterEach(() => {
  sandbox.restore();
});

describe('#graphQL route', () => {
  const graphqlRouter = new GraphQLRouter(routerOpts)
    describe('#smoketest', () => {
      it('graphQL route should exist with proper configs', (done) => {
        expect(graphqlRouter).to.be.ok;
        expect(graphqlRouter.storage).to.be.ok;
        expect(graphqlRouter.schema).to.be.ok;
        expect(graphqlRouter.mailer).to.be.ok;
        expect(graphqlRouter.contracts).to.be.ok;
        expect(graphqlRouter.config).to.equal(routerOpts.config);
        expect(graphqlRouter._verify).to.be.ok;
        expect(graphqlRouter.graphqlHTTPMiddleware).to.be.ok;
        done();
      });
    });

});
