### Billing

### Setup

1. Fork and clone `Storj/billing`

2. Launch local Mongo instance (use Docker or native Mongo [https://docs.mongodb.com/manual/installation/](installation instructions)).

3. `npm link` this shit

Fork and clone `Storj/core`
Fork and clone `Storj/service-storage-models`
Fork and clone `Storj/service-middleware`
Fork and clone `Storj/mongodb-adapter`
cd into each respectively and run:
`npm install`
`npm link`

4. Navigate to `billing` repo in your terminal

Run:

```sh
$ npm install
$ npm link storj-lib
// /Users/barbara/Documents/Code/billing/node_modules/storj-lib -> /Users/barbara/.nvm/versions/node/v6.9.1/lib/node_modules/storj-lib -> /Users/barbara/Documents/Code/core
$ nodemon bin/storj-billing.js
```

5. Fork and clone `Storj/service-storage-models`, `npm i`, `npm link` --> /Users/barbara/.nvm/versions/node/v6.9.1/lib/node_modules/storj-service-storage-models -> /Users/barbara/Documents/Code/service-storage-models

6. Go back to `billing`
`npm link storj-lib`
`npm link storj-service-storage-models`
`npm link storj-service-middleware`
`npm link storj-mongodb-adapter`

In service-storage-models run:
`npm link storj-lib`


barbara in ~/Documents/Code/mongodb-adapter on master*
🦄  npm link
/Users/barbara/.nvm/versions/node/v6.9.1/lib/node_modules/storj-mongodb-adapter -> /Users/barbara/Documents/Code/mongodb-adapter
barbara in ~/Documents/Code/mongodb-adapter on master*
🦄  cd ../billing/
barbara in ~/Documents/Code/billing on master*
🦄  vim package.json
barbara in ~/Documents/Code/billing on master*
🦄  npm link storj-service-middleware
/Users/barbara/Documents/Code/billing/node_modules/storj-service-middleware -> /Users/barbara/.nvm/versions/node/v6.9.1/lib/node_modules/storj-service-middleware -> /Users/barbara/Documents/Code/service-middleware
barbara in ~/Documents/Code/billing on master*
🦄  npm link storj-mongodb-adapter
/Users/barbara/Documents/Code/billing/node_modules/storj-mongodb-adapter -> /Users/barbara/.nvm/versions/node/v6.9.1/lib/node_modules/storj-mongodb-adapter -> /Users/barbara/Documents/Code/mongodb-adapter
barbara in ~/Documents/Code/billing on master*
