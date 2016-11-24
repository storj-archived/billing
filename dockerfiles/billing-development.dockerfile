FROM storjlabs/node-storj:latest

RUN mkdir /billing
RUN ln -s /storj-base/node_modules/ /billing/node_modules

RUN npm i -g nodemon
RUN yarn install

WORKDIR /billing

CMD npm run start-dev
