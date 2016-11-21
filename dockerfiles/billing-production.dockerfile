FROM storjlabs/node-storj:latest

RUN mkdir /billing
RUN ln -s /storj-base/node_modules/ /billing/node_modules

COPY ./package.json /billing/package.json
COPY ./bin /billing/bin
COPY ./lib /billing/lib
COPY ./index.js /billing/index.js

RUN npm i -g nodemon
RUN npm install

WORKDIR /billing

CMD npm run start-prod
