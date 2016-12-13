FROM node:6

# CONTEXT IS `./dockerfiles/files` DIR
COPY ./billing-queries.service /lib/systemd/system/billing-queries.service
COPY ./billing-queries.timer /lib/systemd/system/billing-queries.timer
COPY ./billing-queries.package.json /root/package.json

WORKDIR /root

RUN npm install

CMD systemctl start billing-queries.timer
