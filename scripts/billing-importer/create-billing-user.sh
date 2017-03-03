# Create ECDSA Key Pair

#!/usr/bin/env node
var storj = require('storj-lib');

var key = storj.KeyPair().getPrivateKey();
var publicKey = storj.KeyPair().getPublicKey();

# Create a mongo document in publickeys using the public key that you generated as the value for _id in mongo
db.publickeys.insert({ _id: "023cfaea1c82d45ff24d40643a7910c3ddd396dedaedbee8aea8330b1faf17d3a4", "user": "billing-importer@storj.io", "label": "", "created": ISODate()})

# Create a user in bridge
# Must not have an actgivator or resetter, deactivator and needs to be activated true
db.users.insert({ "_id" : "billing-importer@storj.io", "hashpass" : null, "bytesDownloaded" : { "lastMonthBytes" : 0, "lastDayBytes" : 0, "lastHourBytes" : 0 }, "bytesUploaded" : { "lastMonthBytes" : 0, "lastDayBytes" : 0, "lastHourBytes" : 0 }, "isFreeTier" : true, "activated" : true, "resetter" : null, "deactivator" : null, "activator" : null, "created" : ISODate("2017-02-17T00:59:57.243Z"), "pendingHashPass" : null, "__v" : 0})

# Must create a plan in billing (currently called premium)
