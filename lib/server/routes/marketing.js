'use strict';

const Router = require('./index');
const moment = require('moment');
const inherits = require('util').inherits;
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const log = require('../../logger');
const errors = require('storj-service-error-types');
const Promise = require('bluebird');

function MarketingRouter(options) {
  if (!(this instanceof MarketingRouter)) {
    return new MarketingRouter(options);
  }

  Router.apply(this, arguments);

  this.models = options.storage.models;
  this.authenticate = middleware.authenticate(options.storage);
}

inherits(MarketingRouter, Router);

MarketingRouter.prototype.get = function (req, res) {

  const Marketing = this.models.Marketing;
  const user = req.query.user;

  Marketing.findOne({ user }).then((doc) => {
    if (doc) {
      return res.status(200).send(doc);
    }

    Marketing.create(user, function (err, marketing) {
      if (err) {
        return res.status(500).send(new errors.InternalError(err.message));
      }
      res.status(200).send(marketing);
    });
  });
};

MarketingRouter.prototype.create = function (req, res) {

}

MarketingRouter.prototype._definitions = function() {
  return [
    ['GET', '/marketing',
      this.authenticate,
      this.get
    ]
  ];
};

module.exports = MarketingRouter;
