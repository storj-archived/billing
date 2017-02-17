FROM node:6

COPY ./dockerfiles/files/billing-queries.package.json /root/package.json
COPY ./bin /root/bin/
COPY ./lib/queries /root/lib/queries
COPY ./lib/utils /root/lib/utils
COPY ./lib/constants.js /root/lib/constants.js
ENV BILLING_URL https://billing.staging.storj.io
RUN chmod +x /root/bin/billing-queries.js

WORKDIR /root

RUN npm install

CMD node /root/bin/billing-queries.js
