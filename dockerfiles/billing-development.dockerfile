FROM storjlabs/node-storj:latest

EXPOSE 3000

RUN mkdir /billing
WORKDIR /billing

RUN yarn global add nodemon

COPY ./package.json /billing/package.json
RUN yarn install --ignore-engines

COPY ./bin /billing/bin
COPY ./lib /billing/lib
COPY ./index.js /billing/index.js

CMD npm run start-dev
