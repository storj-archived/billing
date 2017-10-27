FROM storjlabs/node-storj:latest

# We use dumb-init since Node.js is pretty terrible at running as PID 1
RUN wget -O /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64 \
 && chmod +x /usr/local/bin/dumb-init

# wait.sh forces our app to wait for other containers to come up before starting
# Should pull this into the repo to cache it or use the included wait scritp that comes with newer docker
# We shouldn't have to do this at all however. Our services should wait for other services until they are alive.
RUN wget -O /usr/local/bin/wait.sh https://raw.githubusercontent.com/Storj/storj-sdk/master/scripts/wait.sh

EXPOSE 3000

RUN mkdir /opt/billing
# Map `/opt/app` to this services project root
RUN ln -s /opt/billing /opt/app
WORKDIR /opt/billing

RUN yarn global add nodemon

COPY ./package.json /opt/billing/package.json
RUN yarn install --ignore-engines

COPY ./bin /opt/billing/bin
COPY ./lib /opt/billing/lib
COPY ./index.js /opt/billing/index.js
COPY ./test /opt/billing/test

# Add setup script which takes care of vendored modules
ADD ./setup.sh /usr/local/bin/setup.sh

# Pass everything through dumb-init and wait.sh first, making sure our process handles the responsibilities of PID 1 and waits for services it depends on to start before coming up.
ENTRYPOINT ["dumb-init", "--"]

# The default command this container will run is the billing server, but the user can pass in their own commands which get handled by wait.sh and dumb-init.
CMD ["/bin/bash", "/usr/local/bin/wait.sh", "/usr/local/bin/setup.sh", "npm run start:dev"]
