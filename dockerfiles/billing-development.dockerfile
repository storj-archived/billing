FROM storjlabs/node-storj:latest

ENV THOR_ENV development

RUN mkdir /billing
RUN ln -s /storj-base/node_modules/ /billing/node_modules

RUN npm i -g nodemon
RUN yarn install --ignore-engines

WORKDIR /billing

CMD npm run start-dev
