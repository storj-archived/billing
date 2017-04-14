FROM node:6

COPY ./dockerfiles/files/billing-queries.package.json /root/package.json

RUN npm install

COPY ./bin /root/bin/
COPY ./lib/queries /root/lib/queries
COPY ./lib/utils /root/lib/utils
COPY ./lib/constants.js /root/lib/constants.js

ENV BILLING_URL http://billing

RUN chmod +x /root/bin/billing-queries.js

WORKDIR /root

CMD npm run start-importer
