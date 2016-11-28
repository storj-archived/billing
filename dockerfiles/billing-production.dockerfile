FROM storjlabs/node-storj:billing-latest

# TODO: use `production` but first we have to fix packages `engines` to be all compatible with 6.x
#ENV THOR_ENV production
ENV THOR_ENV development

RUN mkdir /billing
RUN ln -s /storj-base/node_modules/ /billing/node_modules

COPY ./package.json /billing/package.json
COPY ./bin /billing/bin
COPY ./lib /billing/lib
COPY ./index.js /billing/index.js

RUN yarn install --ignore-engines

WORKDIR /billing

CMD npm run start-prod
