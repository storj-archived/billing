'use strict';

const storage = require('storj-service-storage-models');
const crypto = require('crypto');
const KeyPair = require('storj-lib').KeyPair;
const constants = require('../../../constants');

const privKey = new PrivateKey();
const herokuPublicKey = new PublicKey(privKey);

const herokuAdapter = {
  register: function(signature, email) {
    const PublicKey = this.storage.models.PublicKey;
    PublicKey.find({ user: email})
      .then(function(pubkey) {
        console.log(pubkey);
        // TODO: Stop pubkey from overriding _id and store pubkey with semantic name
        // _id is where the pubkey is actually stored
        const userPubkey = KeyPair.fromString(pubkey._id)

      })

    return Promise.resolve()
  },
  serializeData: function() {
    return [];
  }
};

module.exports = herokuAdapter;
