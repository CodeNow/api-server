var cp = require('child_process');
var configs = require('configs');
var error = require('error');
var mongoose = require('mongoose');
var request = require('request');
var sync = require('models/sync');
var uuid = require('node-uuid');
var _ = require('lodash');
var textSearch = require('mongoose-text-search');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;
var BaseSchema = require('models/BaseSchema');
var Channel = require('models/channels');
var async = require('async');
var utils = require('middleware/utils');
var path = require('path');
var nab = require('github-nabber');
var url = require('url');
var ArchiveImageSchema = new Schema({
  name: {
    type: String,
    index: { unique: true }
  },
  description: {
    type: String,
    'default': ''
  },
  owner: {
    type: ObjectId,
    index: true
  },
  parent: {
    type: ObjectId,
    index: true
  },
  created: {
    type: Date,
    'default': Date.now,
    index: true
  },
  image: { type: String },
  revisions: [{
    repo: String,
    created: {
      type: Date,
      'default': Date.now,
      index: true
    }
  }],
  dockerfile: { type: String },
  cmd: { type: String },
  copies: {
    type: Number,
    'default': 0,
    index: true
  },
  pastes: {
    type: Number,
    'default': 0,
    index: true
  },
  cuts: {
    type: Number,
    'default': 0,
    index: true
  },
  runs: {
    type: Number,
    'default': 0,
    index: true
  },
  views: {
    type: Number,
    'default': 0,
    index: true
  },
  votes: {
    type: Number,
    'default': 0,
    index: true
  },
  port: { type: Number },
  synced: { type: Boolean },
  tags: {
    type: [{
      channel: {
        type: ObjectId,
        index: { sparse: true }
      }
    }],
    'default': []
  },
  output_format: { type: String },
  service_cmds: {
    type: String,
    'default': ''
  },
  start_cmd: {
    type: String,
    'default': 'date'
  },
  build_cmd: {
    type: String,
    'default': ''
  },
  file_root: {
    type: String,
    'default': '/root'
  },
  file_root_host: {
    type: String,
    'default': './src'
  },
  last_write: { type: Date },
  files: {
    type: [{
      name: { type: String },
      path: { type: String },
      dir: { type: Boolean },
      'default': {
        type: Boolean,
        'default': false
      },
      content: { type: String },
      ignore: { type: Boolean }
    }],
    'default': []
  },
  specification: {
    type: ObjectId,
    index: { sparse: true }
  }
});
ArchiveImageSchema.plugin(textSearch);
ArchiveImageSchema.set('toJSON', { virtuals: true });
ArchiveImageSchema.index({
  name: {
    unique: true
  }
});
ArchiveImageSchema.index({
  tags: 1,
  parent: 1
});
ArchiveImageSchema.index({
  name: 'text',
  tags: 'text'
});

var encodedObjectIdProperties = ['_id', 'parent', 'target', 'child'];

_.extend(ArchiveImageSchema.methods, BaseSchema.methods);
_.extend(ArchiveImageSchema.statics, BaseSchema.statics);

ArchiveImageSchema.set('toJSON', { virtuals: true });

ArchiveImageSchema.virtual('appUrl').get(function () {
  return path.join(utils.encodeId(this._id),
      utils.urlFriendly(this.name));
});

ArchiveImageSchema.methods.inheritFromImage = function (image, cb) {
  if (image.toJSON) {
    image = image.toJSON();
  }

  this.set(image);
  if (cb) {
    cb(null, this);
  }
};

ArchiveImageSchema.methods.getParentName = function (cb) {
  if (!this.parent) {
    cb(null, null);
  } else {
    Image.findById(this.parent, {name:1}, function(err, image) {
      if (err) {
        cb(err);
      }
      else if (!image) {
        cb();
      }
      else {
        cb(null, image.name);
      }
    });
  }
};

ArchiveImageSchema.methods.returnJSON = function (cb) {
  var json = this.encodeJSON();

  async.parallel({
    tags: this.getTags.bind(this),
    parentName: this.getParentName.bind(this)
  }, function (err, extend) {
    if (err) {
      cb(err);
    }
    else {
      _.extend(json, extend);
      cb(null, json);
    }
  });
};

ArchiveImageSchema.methods.encodeJSON = function () {
  var json = this.toJSON();
  encodedObjectIdProperties.forEach(function (key) {
    var val = json[key];
    json[key] = val ? utils.encodeId(val) : val;
  });
  return json;
};

ArchiveImageSchema.methods.getTags = function (cb) {
  if (!this.tags) {
    return cb();
  }
  var channelIds = this.tags.map(function (tag) {
    return tag.channel;
  });
  var self = this;
  Channel.find({ _id: { $in: channelIds } }).lean().exec(function (err, channels) {
    var tags = self.tags.map(function (tag) {
      var channel = _.findWhere(channels, function (channel) {
        return utils.equalObjectIds(tag.channel, channel._id);
      });
      var clone = _.clone(channel);
      return _.extend(clone, tag.toJSON());
    });
    cb(null, tags);
  });
};

ArchiveImageSchema.methods.getScore = function () {
  var image = this;
  var now = new Date();
  var created = new Date(image.created);
  var hours = Math.abs(now - created) / 1000 / 60 / 60;

  return calculateScore(image.runs, hours);

  function calculateScore(runs, hours) {
    return (runs + 3) / Math.pow(hours + 2, 1.5);
  }
};

ArchiveImageSchema.methods.getRepo = function () {
  var image = this;
  var repo;
  if (image.revisions && image.revisions.length) {
    var length = image.revisions.length;
    var revision = image.revisions[length - 1];
    repo = revision.repo ? revision.repo : revision._id.toString();
  } else {
    repo = image._id.toString();
  }
  return [configs.dockerRegistry, 'runnable', repo].join('/');
};

ArchiveImageSchema.statics.fetchChannelImage = function (channel, callback) {
  var self = this;
  async.waterfall([
    function (cb) {
      if (channel.base) {
        self.findById(channel.base, cb);
      }
      else {
        self.findFirstImageInChannel(channel._id, cb);
      }
    }
  ], callback);
};

ArchiveImageSchema.statics.findFirstImageInChannel = function (channelId) {
  var args = Array.prototype.slice.call(arguments, 1);
  var cb = args.pop();
  var query = { 'tags.channel': channelId };
  var fields = args[0] || null; // default: all fields
  var opts = _.extend(args[1] || {}, {
    sort: { _id: 1 },
    limit: 1
  });
  Image.find(query, fields, opts, function (err, images) {
    cb(err, images && images[0]);
  });
};

ArchiveImageSchema.statics.countInChannelByOwner = function (channelId, ownerId, cb) {
  this.count({
    'owner': ownerId,
    'tags.channel': channelId
  }, cb);
};

ArchiveImageSchema.statics.findByName = function (name) {
  var args = Array.prototype.slice.call(arguments, 1); // slice off name arg
  var query = { name: name };
  args.unshift(query);
  this.findOne.apply(this, args);
};

ArchiveImageSchema.statics.findNameConflict = function (name, cb) {
  this.findByName(name, { _id: 1, name: 1 }, function (err, image) {
    if (err) {
      cb(err);
    } else if (image) { // TODO: change to 409, tests and frontend?
      cb(error(403, 'a shared runnable by that name already exists'));
    } else {
      cb();
    }
  });
};

ArchiveImageSchema.statics.findPublished = function (/* args */) {
  var args = Array.prototype.slice.call(arguments);
  var query = args[0];
  query['tags.0'] = { $exists: true };

  this.find.apply(this, args);
};

ArchiveImageSchema.statics.findByAllChannelIds = function (channelIds) {
  channelIds = Array.isArray(channelIds) ? channelIds : [channelIds];
  var args = Array.prototype.slice.call(arguments, 1);
  var query = {};
  query.$and = channelIds.map(function (channelId) {
    return { 'tags.channel': channelId };
  });
  args.unshift(query);
  this.find.apply(this, args);
};


ArchiveImageSchema.statics.aggregateTagsOnImages = function (imageIds, cb) {
  imageIds = imageIds.map(utils.createObjectId);
  var match = {
    $match: {
      _id: {
        $in: imageIds
      }
    }
  };
  var project = {
    $project: {
      _id: 1,
      tags: 1
    }
  };
  var unwind = {
    $unwind: '$tags'
  };
  var group = {
    $group: {
      _id: '$tags.channel',
      images: {
        $sum: 1
      }
    }
  };
  Image.aggregate(match, project, unwind, group, function (err, tagResults) {
    cb(err, tagResults); // lambda shows that the result is not images
  });
};

//OLD BELOW


var syncDockerImage = function (domain, image, cb) {
  var servicesToken = 'services-' + uuid.v4();
  var repoId;
  if (image.revisions && image.revisions.length) {
    var length = image.revisions.length;
    repoId = image.revisions[length - 1]._id.toString();
  } else {
    repoId = image._id.toString();
  }
  var imageTag = '' + configs.dockerRegistry + '/runnable/' + repoId;
  request({
    pool: false,
    url: '' + configs.harbourmaster + '/containers',
    method: 'POST',
    json: {
      servicesToken: servicesToken,
      webToken: 'web-' + uuid.v4(),
      Env: [
        'RUNNABLE_USER_DIR=' + image.file_root,
        'RUNNABLE_SERVICE_CMDS=' + image.service_cmds,
        'RUNNABLE_START_CMD=' + image.start_cmd,
        'RUNNABLE_BUILD_CMD=' + image.build_cmd,
        'SERVICES_TOKEN=' + servicesToken,
        'APACHE_RUN_USER=www-data',
        'APACHE_RUN_GROUP=www-data',
        'APACHE_LOG_DIR=/var/log/apache2',
        'PATH=/dart-sdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      ],
      Hostname: image._id.toString(),
      Image: imageTag,
      PortSpecs: [image.port.toString()],
      Cmd: [image.cmd]
    }
  }, domain.intercept(function (res, body) {
    if (res.statusCode !== 204) {
      cb(error(res.statusCode, body));
    } else {
      sync(domain, servicesToken, image, domain.intercept(function () {
        request({
          pool: false,
          url: '' + configs.harbourmaster + '/containers/' + servicesToken,
          method: 'DELETE'
        }, domain.intercept(function (res) {
          if (res.statusCode !== 204) {
            cb(error(res.statusCode, body));
          } else {
            cb();
          }
        }));
      }));
    }
  }));
};

//OLD BELOW


ArchiveImageSchema.statics.search = function (searchText, cb) {
  this.find({$text: {$search: searchText}}, 
        {
          name: 1,
          description: 1,
          tags: 1,
          owner: 1,
          created: 1
        })
       .skip(0)
       .limit(configs.defaultPageLimit)
       .exec(function(err, images) { 
          if (err) {
            return cb(err);
          } else {
            cb(null, images);}
        });
};


ArchiveImageSchema.methods.updateFromContainer = function (domain, container, cb) {
  var self = this;
  copyPublishProperties(self, container, true);
  self.revisions = self.revisions || [];
  self.revisions.push({ repo: container._id.toString() });
  container.child = self._id;
  container.save(domain.intercept(function () {
    self.save(domain.intercept(function () {
      cb(null, self);
    }));
  }));
};
ArchiveImageSchema.statics.destroy = function (domain, id, cb) {
  var self = this;
  this.findOne({ _id: id }, domain.intercept(function (image) {
    if (!image) {
      cb(error(404, 'image not found'));
    } else {
      self.remove({ _id: id }, domain.intercept(function () {
        cb();
      }));
    }
  }));
};
ArchiveImageSchema.statics.listTags = function (domain, cb) {
  this.find().distinct('tags.name', domain.intercept(function (tagNames) {
    cb(null, tagNames);
  }));
};
ArchiveImageSchema.statics.relatedChannelIds = function (domain, channelIds, cb) {
  this.distinct('tags.channel', {
    'tags.channel': {
      $in: channelIds
    }
  }, domain.intercept(function (channelIds) {
    cb(null, channelIds);
  }));
};
ArchiveImageSchema.statics.isOwner = function (domain, userId, runnableId, cb) {
  this.findOne({ _id: runnableId }, {
    _id: 1,
    owner: 1
  }, domain.intercept(function (image) {
    if (!image) {
      cb(error(404, 'runnable not found'));
    } else {
      cb(null, image.owner.toString() === userId.toString());
    }
  }));
};
ArchiveImageSchema.methods.sync = function (domain, cb) {
  var self = this;
  if (this.synced) {
    cb();
  } else {
    syncDockerImage(domain, this, domain.intercept(function () {
      self.synced = true;
      self.save(domain.intercept(function () {
        cb();
      }));
    }));
  }
};
ArchiveImageSchema.statics.countInChannel = function (channelId, cb) {
  this.count({ 'tags.channel': channelId }, cb);
};
ArchiveImageSchema.statics.countInChannelByOwner = function (channelId, userId, cb) {
  this.count({ 'tags.channel': channelId, owner: userId }, cb);
};
var copyPublishProperties = function (image, container, noOwner) {
  var objectIdProperties, properties;
  properties = [
    'name',
    'description',
    'tags',
    'files',
    'image',
    'dockerfile',
    'file_root',
    'file_root_host',
    'cmd',
    'build_cmd',
    'start_cmd',
    'service_cmds',
    'port',
    'output_format',
    'last_write'
  ];
  objectIdProperties = [
    'parent',
    'specification'
  ];
  if (!noOwner) {
    objectIdProperties.push('owner');
  }
  properties.forEach(function (property) {
    if (property === 'last_write') {
      image[property] = new Date(container[property]);
    }
    else {
      image[property] = _.clone(container[property]);
    }
  });
  objectIdProperties.forEach(function (property) {
    image[property] = container[property] && container[property].toString();
  });
};
var Image = module.exports = mongoose.model('ArchiveImages', ArchiveImageSchema);
