FROM storjlabs/node-storj:latest

EXPOSE 3000

ENV THOR_ENV development

RUN mkdir /billing
RUN ln -s /storj-base/node_modules/ /billing/node_modules

RUN yarn global add nodemon

COPY ./package.json /billing/package.json
RUN yarn install --ignore-engines

WORKDIR /billing

CMD npm run start-dev
