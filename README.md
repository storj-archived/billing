## Billing Setup

### 1. Fork and clone `Storj/billing`

### 2. Launch local Mongo instance (use Docker or native Mongo [https://docs.mongodb.com/manual/installation/](installation instructions)).

### 3. `npm link`

### Fork and clone repos

Fork and clone `Storj/core`
Fork and clone `Storj/service-storage-models`
Fork and clone `Storj/service-middleware`
Fork and clone `Storj/mongodb-adapter`

#### `npm install` and `npm link`

cd into each repo and run:

```sh
$ npm install
$ npm link
```

You should see something like this every time:
`/Users/barbara/.nvm/versions/node/v6.9.1/lib/node_modules/storj-service-storage-models -> /Users/barbara/Documents/Code/service-storage-models`

#### `npm link storj-lib` to `service-storage-models`

In `service-storage-models`, also run:

```sh
$ npm link storj-lib
```

#### Link everything to `billing`
Now navigate to your local copy of the `billing` repo

Run:

```sh
$ npm install
$ npm link storj-lib
$ npm link storj-service-storage-models
$ npm link storj-service-middleware
$ npm link storj-mongodb-adapter
```

After every `npm link XXX` you should see something like this:

`/Users/barbara/Documents/Code/billing/node_modules/storj-lib -> /Users/barbara/.nvm/versions/node/v6.9.1/lib/node_modules/storj-lib -> /Users/barbara/Documents/Code/core`

### 4. Create `.env` file

Create a `.env` file in the root of the project. Add necessary environment variables.

### 5. Run `nodemon bin/storj/billing.js`

See something like this:

```sh
barbara in ~/Documents/Code/billing on master*
🦄  nodemon bin/storj-billing.js
[nodemon] 1.11.0
[nodemon] to restart at any time, enter `rs`
[nodemon] watching: *.*
[nodemon] starting `node bin/storj-billing.js`
**** server listening on  3000
{"level":"info","message":"starting the billing engine","timestamp":"2017-01-04T00:45:03.388Z"}
{"level":"info","message":"opening database connection to mongodb://127.0.0.1:27017/__storj-bridge-development","timestamp":"2017-01-04T00:45:03.389Z"}
{"level":"info","message":"configuring service endpoints","timestamp":"2017-01-04T00:45:03.414Z"}
{"level":"info","message":"setting up http(s) server instance","timestamp":"2017-01-04T00:45:03.655Z"}
{"level":"info","message":"connected to database","timestamp":"2017-01-04T00:45:03.676Z"}
```
