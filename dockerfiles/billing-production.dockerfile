FROM storjlabs/node-storj:billing-latest

ENV THOR_ENV production

RUN mkdir /billing
RUN ln -s /storj-base/node_modules/ /billing/node_modules

COPY ./package.json /billing/package.json
COPY ./bin /billing/bin
COPY ./lib /billing/lib
COPY ./index.js /billing/index.js

RUN yarn install

WORKDIR /billing

CMD npm run start-prod
