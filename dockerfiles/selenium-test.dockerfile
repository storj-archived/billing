FROM ruby
RUN apt-get update && apt-get install -y build-essential
RUN mkdir /billing
WORKDIR /billing

ADD ./Gemfile /billing/Gemfile
ADD ./Gemfile.lock /billing/Gemfile.lock

RUN bundle install
