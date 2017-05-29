var async = require('async');
var _ = require('lodash');
var error = require('error');
var redis = require('models/redis');
var ArchiveImage = require('models/archiveImages');
var Channel = require('models/channels');
var configs = require('configs');
var utils = require('middleware/utils');
var keypather = require('keypather')();
var createMongooseMiddleware = require('./createMongooseMiddleware');
var series = utils.series;
var pluck = require('101/pluck');


var archiveImages = module.exports = createMongooseMiddleware(ArchiveImage, {
  createFromImage: function(imageKey) {
    var images = require('middleware/images');
    return series(
      archiveImages.create(),
      archiveImages.model.inheritFromImage(imageKey),
      archiveImages.model.save()
    );
  },
  respond: function (req, res, next) {
    var self = this;
    var model = req[this.key];
    if (model) {
      if (model.returnJSON) {
        model.returnJSON(req.domain.intercept(function (json) {
          req[self.key] = json;
          self.super.respond(req, res, next);
        }));
      }
      else {
        self.super.respond(req, res, next);
      }
    }
    else if (req[this.pluralKey]) {
      this.respondList(req, res, next);
    }
    else {
      this.checkFound(req, res, next);
    }
  },
  findPageInChannels: function (channelsKey) {
    return function (req, res, next) {
      var channelIds = keypather.get(req, channelsKey) || [];
      if (!channelIds.length) {
        req.query.findNoDocuments = true;
      }
      else {
        req.query.$and = channelIds.map(function (channelId) {
          return { 'tags.channel': channelId };
        });
      }
      archiveImages.findPage('query', { files: 0 })(req, res, next);
    };
  },
  respondList: function (req, res, next) {
    var self = this;
    var models = req[this.pluralKey];
    async.map(models, function (model, cb) {
      if (model.returnJSON) {
        model.returnJSON(cb);
      }
      else {
        cb(null, model);
      }
    },
    req.domain.intercept(function (models) {
      if (req.paging) {
        req[self.pluralKey] = {
          data: models,
          paging: req.paging
        };
      }
      else {
        req[self.pluralKey] = models;
      }
      self.super.respondList(req, res, next);
    }));
  }
});
