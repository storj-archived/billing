'use strict';

require('dotenv').config();

const hat = require('hat');
const storj = require('storj-lib');
const assert = require('assert');
const express = require('express');
const crossorigin = require('cors');
const pkginfo = require('../package');
const Config = require('./config');
const Storage = require('storj-service-storage-models');
const middleware = require('storj-service-middleware');
const Server = require('./server');
const Mailer = require('storj-service-mailer');
const log = require('./logger');
const MongoDBStorageAdapter = require('storj-mongodb-adapter');
const helmet = require('helmet');

/**
 * Primary interface to billing (the glue)
 * @constructor
 * @param {Config} config
 */
function Engine(config) {
  if (!(this instanceof Engine)) {
    return new Engine(config);
  }

  assert(config instanceof Config, 'Invalid config supplied');

  this._config = config;
  this._apispec = null;
  this._pendingResponses = [];
}

/**
 * Starts the billing instance
 * @param {Function} callback
 */
Engine.prototype.start = function(callback) {
  var self = this;

  log.info('starting the billing engine');
  log.info('connecting to mongoose');

  self.storage = new Storage(
    self._config.storage.mongoURI,
    self._config.storage.mongoOptions,
    { logger: log }
  );
  self.mailer = new Mailer(self._config.mailer);
  self.server = new Server(self._config.server, self._configureApp());
  self.contracts = new storj.StorageManager(
    new MongoDBStorageAdapter(self.storage.connection)
  );

  callback();

  process.on('SIGINT', function() {
    log.info('received shutdown signal, waiting for pending responses');
    setInterval(function() {
      if (Object.keys(self._pendingResponses).length === 0) {
        process.exit();
      }
    }, 1000);
  });

  process.on('exit', function() {
    log.info('billing service is shutting down');
  });

  if (process.env.NODE_ENV !== 'test') {
    process.on('uncaughtException', function(err) {
      log.error('an unhandled exception occurred: %s', err.message);
      log.error('exception stack: %s', err.stack);
      process.exit(1);
    });
  }
};

/**
 * Configures the express app and loads routes
 * @private
 */
Engine.prototype._configureApp = function() {
  log.info('configuring service endpoints');

  let self = this;
  const routers = Server.Routes({
    config: this._config,
    storage: this.storage,
    mailer: this.mailer,
    contracts: this.contracts
  });

  const corsOptions = {
    credentials: true,
    origin: function (origin, next) {
      const corsRegex = new RegExp(self._config.server.corsRegex);
      const originAllowed = function () {
        if (process.env.NODE_ENV !== 'production') {
          log.warn('Insecure CORS configuration in use; non-production env detected');
          return true;
        }

        return corsRegex.test(origin);
      };

      next(null, originAllowed());
    }
  };

  const app = express();
  function bindRoute(route) {
    let verb = route.shift().toLowerCase();
    app[verb].apply(app, route);
  }

  self._keepPendingResponsesClean();
  app.use(this._trackResponseStatus.bind(this));
  app.use(helmet());

  app.use(crossorigin(corsOptions));
  app.get('/', function(req, res) {
    res.send(self.getSpecification());
  });

  routers.forEach(bindRoute);
  app.use(middleware.errorhandler);

  return app;
};

/**
 * Keeps tabs on all of the pending responses
 * @private
 */
Engine.prototype._trackResponseStatus = function(req, res, next) {
  this._pendingResponses[hat()] = res;
  next();
};

/**
 * Clean up the pending request stack
 * @private
 */
Engine.prototype._keepPendingResponsesClean = function() {
  var self = this;

  setInterval(function() {
    for (var id in self._pendingResponses) {
      if (self._pendingResponses[id].finished) {
        delete self._pendingResponses[id];
      }
    }
  }, 5000);
};

/**
 * Returns a dictionary of info about the service
 * @returns {Object}
 */
Engine.prototype.getSpecification = function() {
  if (!this._apispec) {
    this._apispec = require('./apispec.json');
    this._apispec.schemes = this._config.server.ssl.cert ? ['https'] : ['http'];
    this._apispec.host = this._config.server.host;
    this._apispec.info = {
      title: 'Storj billing',
      version: pkginfo.version,
      description: pkginfo.description,
      'x-protocol-version': storj.version.protocol,
      'x-core-version': storj.version.software
    };
  }

  return this._apispec;
};

module.exports = Engine;
