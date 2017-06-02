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
var url = require('url');
var flow = require('middleware-flow');
var mwIf = flow.mwIf.bind(flow);

var createMongooseMiddleware = require('./createMongooseMiddleware');

var containers = module.exports = createMongooseMiddleware(Container, {

  authChangeUpdateOwners: function (req, res, next) {
    var me = require('middleware/me');
    series(
      this.update({ owner: req.user_id }, { $set: { owner: req.me._id.toString() } }),
      mwIf(me.isVerified)
      .then( // allow terminal to new verified user's containers
        this.update({ owner: req.user_id }, { $set: { 'allowTerm': true } })
      )
      .else( // deny terminal to unverified user's containers
        this.update({ owner: req.user_id }, { $set: { 'allowTerm': false } })
      )
      
    )(req, res, next);
  },

  createContainerIfNotYet:  function (req, res, next) {
    var containerJSON = req.container.toJSON();

    series(
      flow.if( !containerJSON.host )
      .then(
        images.findById('container.parent'),
        images.checkFound,
        harbourmaster.createContainer('image', 'container'),
        containers.model.save()
      )
    )(req, res, next);

  },
  updateTermAccess: function (req, res, next) {
    var containerJSON = req.container.toJSON();
    
    series(
      flow.if( containerJSON.isOwnerVerified )
      .then(
        this.model.setAndSave({ allowTerm: true })
      )
      .else(
        this.model.setAndSave({ allowTerm: false })
      )
    )(req, res, next);

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
  killContainers: function (containersKey) {
    return function (req, res, next) {
      async.eachSeries(req[containersKey], function (childContainer, callback) {
        series(
          harbourmaster.wipeContainer(childContainer)
        )(req, res, callback)
      }, function (err) {
        // if (err) { new Error(err); }
        next();
      });

    };
  },
  findRunningContainers: function(req, res, next) {
    return series(
      harbourmaster.listDocklets(),
      askDocklets,
      this.find({ 
        'containerId': { $in: 'dockerIds' } }, 
        'containerId host last_write name owner servicesToken status saved created description create_ip',
        function (err, docs) {
          if(!err) { req.containers = docs; }
          next();
      })
    )(req, res, next);

    function askDocklets (req, res, next) {
      var availableDocklets = req.hipacheHostsResult;
      req.dockerIds = new Array;

      async.eachSeries(availableDocklets, function (docklet, callback) {
        var parsedDocklet = url.parse( docklet );
        series(
          docker.create(parsedDocklet.hostname),
          docker.model.listContainers(),
          pluckIds
        )(req, res, callback)
      }, function (err) {
        if (err) { new Error(err); }
        next();
      })
    }

    function pluckIds (req, res, next) {
      var dockers = req.dockerResult;
      req.dockerIds=req.dockerIds.concat( dockers.map(pluck('Id')) );
      next();
    }
  }
});
