FROM node:6

# TODO: use `production` but first we have to fix packages `engines` to be all compatible with 6.x
#ENV THOR_ENV production
ENV THOR_ENV development

RUN mkdir /billing

COPY ./package.json /billing/package.json
COPY ./bin /billing/bin
COPY ./lib /billing/lib
COPY ./index.js /billing/index.js

WORKDIR /billing

RUN npm i --production

CMD npm run start-prod
