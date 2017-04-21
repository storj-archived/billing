FROM node:6

COPY ./dockerfiles/files/billing-queries.package.json /root/package.json

WORKDIR /root

RUN npm install

COPY ./bin /root/bin/
COPY ./lib/queries /root/lib/queries
COPY ./lib/utils /root/lib/utils
COPY ./lib/constants.js /root/lib/constants.js
COPY ./lib/logger.js /root/lib/logger.js
COPY ./lib/config.js /root/lib/config.js
ENV BILLING_URL http://billing
RUN chmod +x /root/bin/billing-queries.js
RUN chmod +x /root/bin/create-debits.js

CMD npm run start-importer
