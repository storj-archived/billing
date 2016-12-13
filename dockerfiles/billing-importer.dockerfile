FROM node:6

COPY ./dockerfiles/files/billing-queries.package.json /root/package.json
COPY ./bin /root/bin/

WORKDIR /root/bin

RUN npm install

CMD node /root/bin/billing-queries.js
