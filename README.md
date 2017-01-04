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

Create a `.env` file in the root of the project
