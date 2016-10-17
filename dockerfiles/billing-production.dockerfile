FROM node:4.5

RUN mkdir /billing
WORKDIR /billing

ADD . /billing

RUN npm i

CMD npm run start-prod
#CMD sleep 600
