FROM node:6

# We use dumb-init since Node.js is pretty terrible at running as PID 1
RUN wget -O /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64 \
 && chmod +x /usr/local/bin/dumb-init

# wait.sh forces our app to wait for other containers to come up before starting
# Should pull this into the repo to cache it or use the included wait scritp that comes with newer docker
# We shouldn't have to do this at all however. Our services should wait for other services until they are alive.
RUN wget -O /bin/wait.sh https://raw.githubusercontent.com/Storj/storj-sdk/master/scripts/wait.sh

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

# Add setup script which takes care of vendored modules
ADD ./setup.sh /bin/setup.sh

# Pass everything through dumb-init and wait.sh first, making sure our process handles the responsibilities of PID 1 and waits for services it depends on to start before coming up.
ENTRYPOINT ["dumb-init", "--"]

# The default command this container will run is the billing-importer, but the user can pass in their own commands which get handled by wait.sh and dumb-init.
CMD ["/bin/bash", "/bin/wait.sh", "/bin/setup.sh", "npm run start-importer"]
