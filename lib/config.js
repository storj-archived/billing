'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const merge = require('merge');

const ENV = process.env;
const PLATFORM = os.platform();
const DIRNAME = '.storj-billing';
const HOME = PLATFORM === 'win32' ? ENV.USERPROFILE : ENV.HOME;
var storjbillingPath = ENV.STORJ_BILLING_DIR || HOME;
const DATADIR = path.join(storjbillingPath, DIRNAME);
const CONFDIR = path.join(DATADIR, 'config');
const ITEMDIR = path.join(DATADIR, 'items');
const CONSTANTS = require('./constants');

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

    config = merge(
      Object.create(Config.DEFAULTS),
      JSON.parse(fs.readFileSync(envConfigPath))
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

Config.DEFAULTS = {
  application: {
    mirrors: 6
  },
  storage: {
    host: '127.0.0.1',
    port: 27017,
    name: `__storj-bridge-${process.env.NODE_ENV || 'develop'}`,
    user: null,
    pass: null,
    mongos: false,
    ssl: false
  },
  server: {
    host: '127.0.0.1',
    port: process.env.PORT || 6383,
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
    host: '127.0.0.1',
    port: 465,
    secure: true,
    auth: {
      user: 'username',
      pass: 'password'
    },
    from: 'robot@storj.io'
  },
  logger: {
    level: CONSTANTS.LOG_LEVEL_INFO
  }
};

module.exports = Config;
