'use strict';

const storage = require('storj-service-storage-models');

const privKey = new PrivateKey();
const herokuPublicKey = new PublicKey(privKey); 

const herokuAdapter = {
  register: function(signature, email) {
    const User = this.storage.models.User;
    User.find({ email: email})
      .then(function(user) {
        console.log(user);
        // const pubkey = user.pubkey

        const _ECDSA = new ECDSA({
          hashbuf: , //hash buffer representation of the data for the request
          sig: signature, // signature from request - req.headers
          pubkey: process.env.HEROKU_PUBLIC_KEY || herokuPublicKey, //pubkey of heroku service -- from env variable
          endian: //true or false, try it both ways
        })

        return _ECDSA.verify({
          hashbuf: ,
          endian: true,
          sig: signature,
          pubkey: pubkey
        }) //returns true or false I think?

      })

    return Promise.resolve()
  },
  serializeData: function() {
    return [];
  }
};

module.exports = herokuAdapter;
