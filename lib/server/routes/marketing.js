'use strict';

const Router = require('./index');
const moment = require('moment');
const inherits = require('util').inherits;
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const log = require('../../logger');


const errors = require('storj-service-error-types');
const Promise = require('bluebird');

// TODO: Refactor all stripe-related endpoints into a single endpoint
// to remain payment processor agnostic.

/**
 * Handles endpoints for all user related operations
 */
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
  console.log('marketing get');

  const Marketing = this.models.Marketing;
  const user = req.body.user;

  Marketing.find({ user }).then((doc) => {
    if (doc) {
      return res.status(200).send(doc);
    }

    Marketing.create(user, function (err, marketing) {
      if (err) {
        return res.status(500).send(new errors.InternalError(err.message));
      }

      res.status(200).send(marekting);
    });
  });
};

/**
 * Export definitions
 * @private
 */
MarketingRouter.prototype._definitions = function() {
  return [
    ['GET', '/marketing',
      rawbody,
      this.authenticate,
      this.get
    ]
  ];
};

module.exports = MarketingRouter;
