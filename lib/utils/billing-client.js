'use strict';

const logger = require('../logger');
const qs = require('querystring');
const request = require('request');
const KeyPair = require('storj-lib').KeyPair;

/**
 * Represents a client interface to a given billing server
 * @constructor
 * @param {String} uri - API base URI ('https://billing.storj.io')
 * @param {String} privkey - KeyPair instance for request signing
 */
class BillingClient {
  constructor(baseURI, privkey) {
    this._options = {
      baseURI: baseURI,
      keypair: KeyPair(privkey)
    };
  }

  _request(method, path, params, callback) {
    const opts = {
      baseUrl: this._options.baseURI,
      uri: path,
      method: method
    };

    params.__nonce = Date.now();

    if (['GET', 'DELETE'].indexOf(method) !== -1) {
      opts.qs = params;
      opts.json = true;
    } else {
      opts.json = params;
    }

    this._authenticate(opts);

    const requestPromise = new Promise(function(resolve, reject) {
      request(opts, function(err, res, body) {
        if (err) return reject(err);
        logger.debug(`response body: ${JSON.stringify(body)}`);
        logger.debug(`response: ${JSON.stringify(res)}`);
        if (res.statusCode > 400) return reject(new Error(body.error || body));
        resolve(body);
      });
    });

    if (callback) requestPromise.then(callback, callback);

    return requestPromise;
  }

  _authenticate(opts) {
    if (this._options.keypair) {
      var payload = ['GET', 'DELETE'].indexOf(opts.method) !== -1
        ? qs.stringify(opts.qs)
        : JSON.stringify(opts.json);

      var contract = [opts.method, opts.uri, payload].join('\n');

      opts.headers = opts.headers || {};
      opts.headers['x-pubkey'] = this._options.keypair.getPublicKey();
      opts.headers['x-signature'] = this._options.keypair.sign(contract, {
        compact: false
      });
    }

    return opts;
  }

  createDebit(debit) {
    return this._request('POST', '/debits', debit);
  }

  createCredit(credit) {
    return this._request('POST', '/credits', credit)
  }
}

module.exports = BillingClient;
