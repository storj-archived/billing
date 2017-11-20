'use strict';
const Coinpayments = require('coinpayments');

const options = {
  key: process.env.CP_PUBLIC_KEY,
  secret: process.env.CP_PRIVATE_KEY
};

let client;

const getClient = function () {
    if (!client) {
        client = new Coinpayments(options);
    }

    return client;
};

module.exports = getClient;
