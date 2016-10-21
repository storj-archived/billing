FROM storjlabs/storj:thor

RUN mkdir /billing
WORKDIR /billing

ADD . /billing

RUN npm i

WORKDIR /storj-base
RUN thor setup:clone /billing

WORKDIR /billing

CMD npm run start-prod
