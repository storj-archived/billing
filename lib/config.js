'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const merge = require('merge');
const url = require('url');
const _ = require('lodash');

const ENV = process.env;
const PLATFORM = os.platform();
const DIRNAME = '.storj-billing';
const HOME = PLATFORM === 'win32' ? ENV.USERPROFILE : ENV.HOME;
var storjbillingPath = ENV.STORJ_BILLING_DIR || HOME;
const DATADIR = path.join(storjbillingPath, DIRNAME);
const CONFDIR = path.join(DATADIR, 'config');
const ITEMDIR = path.join(DATADIR, 'items');
const CONSTANTS = require('./constants');

const MONGO_URL = process.env.MONGO_URL || ('mongodb://127.0.0.1:27017/__storj-bridge-' + (process.env.NODE_ENV || 'development'));
const MONGO_USERNAME = process.env.MONGO_USERNAME && process.env.MONGO_USERNAME.match(/\S+/)[0];
const MONGO_PASSWORD = process.env.MONGO_PASSWORD && process.env.MONGO_PASSWORD.match(/\S+/)[0];
const MONGOS = process.env.MONGOS && JSON.parse(process.env.MONGOS);
const REPLSET = process.env.REPLSET && JSON.parse(process.env.REPLSET);
const MONGO_SSL = process.env.MONGO_SSL && JSON.parse(process.env.MONGO_SSL);

if (!fs.existsSync(DATADIR)) {
  fs.mkdirSync(DATADIR);
}

if (!fs.existsSync(CONFDIR)) {
  fs.mkdirSync(CONFDIR);
}

if (!fs.existsSync(ITEMDIR)) {
  fs.mkdirSync(ITEMDIR);
}

/**
 * Represents a configuration
 * @constructor
 * @param {String|Object} env
 */
function Config(env) {
  if (!(this instanceof Config)) {
    return new Config(env);
  }

  var config;

  if (typeof env === 'string') {
    var envConfigPath = path.join(CONFDIR, env);

    if (!fs.existsSync(envConfigPath)) {
      fs.writeFileSync(envConfigPath, JSON.stringify(Config.DEFAULTS, null, 2));
    }

    const reduceConfig = function (result, overrideValue, overrideKey) {
      if (overrideValue != null && typeof(overrideValue) === 'object') {
        result[overrideKey] = _.reduce(overrideValue, reduceConfig, {});
      } else if (overrideValue !== null && typeof(overrideValue) !== 'undefined') {
        result[overrideKey] = overrideValue;
      }
      return result;
    };
    const configEnvOverrides = _.reduce(Config.ENV_OVERRIDES, reduceConfig, {});

    config = merge.recursive(
      Config.DEFAULTS,
      JSON.parse(fs.readFileSync(envConfigPath)),
      configEnvOverrides
    );

  } else {
    config = merge(Object.create(Config.DEFAULTS), env);
  }

  for (let prop in config) {
    if (config.hasOwnProperty(prop)) {
      this[prop] = config[prop];
    }
  }
}

Config.ENV_OVERRIDES = {
  storage: {
    mongoURI: MONGO_URL,
    mongoOptions: {
      user: MONGO_USERNAME,
      pass: MONGO_PASSWORD,
      mongos: MONGOS,
      replset: REPLSET,
      ssl: MONGO_SSL
    }
  }
};

Config.DEFAULTS = {
  application: {
    mirrors: 6
  },
  storage: {
    mongoURI: '127.0.0.1:27017/__storj-billing-' + (process.env.NODE_ENV || 'develop'),
    mongoOptions: {
      user: null,
      pass: null,
      mongos: false,
      replset: false,
      ssl: false
    }
  },
  server: {
    host: '127.0.0.1',
    port: parseInt(process.env.PORT, 10) || 3000,
    timeout: 240000,
    ssl: {
      cert: null,
      key: null,
      ca: [],
      redirect: 80
    },
    public: {
      host: '127.0.0.1',
      port: 80
    }
  },
  mailer: {
    host: process.env.MAILER_HOST || '127.0.0.1',
    port: process.env.MAILER_PORT || 465,
    secure: false,
    auth: {
      user: process.env.MAILER_USERNAME || 'username',
      pass: process.env.MAILER_PASSWORD || 'password'
    },
    from: process.env.MAILER_FROM || 'robot@storj.io'
  },
  logger: {
    level: CONSTANTS.LOG_LEVEL_INFO
  }
};

module.exports = Config;
