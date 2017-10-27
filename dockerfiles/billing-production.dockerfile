FROM node:6.10

# We use dumb-init since Node.js is pretty terrible at running as PID 1
RUN wget -O /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64 \
 && chmod +x /usr/local/bin/dumb-init

# wait.sh forces our app to wait for other containers to come up before starting
# Should pull this into the repo to cache it or use the included wait scritp that comes with newer docker
# We shouldn't have to do this at all however. Our services should wait for other services until they are alive.
RUN wget -O /bin/wait.sh https://raw.githubusercontent.com/Storj/storj-sdk/master/scripts/wait.sh

# TODO: use `production` but first we have to fix packages `engines` to be all compatible with 6.x
#ENV THOR_ENV production
ENV THOR_ENV development

RUN mkdir /billing

COPY ./package.json /billing/package.json
COPY ./bin /billing/bin
COPY ./lib /billing/lib
COPY ./index.js /billing/index.js

WORKDIR /billing

RUN yarn --ignore-engines

## Add setup script which takes care of vendored modules
#ADD ./setup.sh /bin/setup.sh
#
## Pass everything through dumb-init and wait.sh first, making sure our process handles the responsibilities of PID 1 and waits for services it depends on to start before coming up.
#ENTRYPOINT ["dumb-init", "--"]
#
## The default command this container will run is the bridge, but the user can pass in their own commands which get handled by wait.sh and dumb-init.
#CMD ["/bin/bash", "/bin/wait.sh", "/bin/setup.sh", "npm run start-prod"]
CMD npm start
