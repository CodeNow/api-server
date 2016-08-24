var utils = require('middleware/utils');
var Container = require('models/containers');
var async = require('async');
var _ = require('lodash');
var body = require('middleware/body');
var harbourmaster = require('middleware/harbourmaster');
var dockworker = require('middleware/dockworker');
var images = require('middleware/images');
var utils = require('middleware/utils');
var series = utils.series;
var ternary = utils.ternary;
var flow = require('middleware-flow');
var docker  = require('middleware/docker');
var pluck = require('101/pluck');

var createMongooseMiddleware = require('./createMongooseMiddleware');

var containers = module.exports = createMongooseMiddleware(Container, {
  authChangeUpdateOwners: function (req, res, next) {
    this.update({
      owner: req.user_id
    }, {
      $set: {
        owner: req.me._id.toString()
      }
    })(req, res, next);
  },
  publish: function (req, res, next) {
    var committingNew = (req.body.status === 'Committing new');
    series(
      flow.if(!req.container.parent || committingNew)
        .then(containers.fullPublish)
        .else(
          images.findById('container.parent', { name: 1, description: 1, tags: 1, last_write: 1 }),
          ternary(containers.metaPublishCheck('image'), // middleware check
            containers.model.metaPublish('image'),
            containers.fullPublish)),
      body.unset('status'))(req, res, next);
  },
  fullPublish: function (req, res, next) {
    var utils = require('middleware/utils');
    series(
      flow.if(req.query.dontBuild)
        .else(dockworker.runBuildCmd),
      body.trim('status'),
      containers.model.atomicUpdateCommitStatusAndName('body', 'me'),
      ternary(containers.checkFound, // atomic update uses findAndModify
        harbourmaster.commitContainer('container'), // container updated successfull
        containers.findById('params.containerId', { files: 0 })),
      containers.model.unset('files'))(req, res, next);
  },
  metaPublishCheck: function (imageKey) {
    return function (req, res, next) {
      var image = utils.replacePlaceholders(req, imageKey);
      if (req.container.metaPublishCheck(image)) {
        next();
      }
      else {
        next(new Error('do a full publish'));
      }
    };
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
      req[self.pluralKey] = models;
      self.super.respondList(req, res, next);
    }));
  },
  respondTag: function (req, res, next) {
    var channelId = req.channel._id;
    req.container.returnJSON(req.domain.intercept(function (containerJSON) {
      var channelTag = _.findWhere(containerJSON.tags, function (tag) {
        return utils.equalObjectIds(tag.channel, channelId);
      });
      res.json(201, channelTag);
    }));
  },
  findRunningContainers: function(req, res, next) {
    return series(
      // temp locate a single docklet
      docker.create('10.91.0.3'),
      docker.model.listContainers(),
      getRunningContianers,
      this.find({ 
        'containerId': { $in: 'dockerIds' } }, 
        'containerId host last_write name owner servicesToken status saved created description create_ip',
        function (err, docs) {
          if(!err) { req.containers = docs; }
          next();
      })
    )(req, res, next);

    function getRunningContianers (req, res, next) {
      var dockers = req.dockerResult;
      req.dockerIds = dockers.map(pluck('Id'));
      next();
    }
  }
});
