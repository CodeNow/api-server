var qs = require('querystring');
var p = require('path');
var _ = require('lodash');
var db = require('./db');
var httpMethods = require('methods');
var fstream = require('fstream');
var tar = require('tar');
var zlib = require('zlib');
var helpers = require('./helpers');
var async = require('./async');
var uuid = require('node-uuid');
var bodyMethods = ['post', 'put', 'patch', 'del'];

var qs = require('querystring');
var p = require('path');
var _ = require('lodash');
var helpers = require('./helpers');
var async = require('./async');
var bodyMethods = ['post', 'put', 'patch', 'del'];

var TestUser = module.exports = function (properties) {
  _.extend(this, properties);
};
['get', 'post', 'put', 'patch', 'delete'] // http methods we actually use
  .forEach(function (method) {
    if (method === 'delete') {
      method = 'del';
    }
    /* TestUser.prototype[post, get, put, patch, delete, ...] */
    TestUser.prototype[method] = function (path, token, opts, callback) {
      if (typeof token === 'object') {
        // (path, opts, callback)
        callback = opts;
        opts = token;
        token = null;
      } else if (typeof token === 'function') {
        // (path, callback)
        callback = token;
        token = null;
      }
      if (typeof opts === 'function') {
        callback = opts;
        opts = {};
      }
      opts = opts || {};
      if (!_.isEmpty(opts) && !opts.qs && !opts.body) { // opts is body or querystring
        opts = ~bodyMethods.indexOf(method) ?
          { body: opts } :
          { qs: opts };
      }
      token = token || this.access_token;
      path = path + (opts.qs ? '?' + qs.stringify(opts.qs) : '');
      var req = helpers.request[method](path, token);
      if (!_.isEmpty(opts.body)) {
        req.send(opts.body);
      }
      if (opts.expect) {
        req.expect(opts.expect);
      }
      if (!callback) {
        return req;
      } else {
        req.end(callback);
      }
    };
    /* TestUser.prototype[postUser, getUser, putUser, patchUser, deleteUser, ...] */
    /* TestUser.prototype[postContainer, getContainer, putContainer, patchContainer, deleteContainer, ...] */
    /* TestUser.prototype[postSpecification, getSpecification, putSpecification, patchSpecification, deleteSpecification, ...] */
    /* TestUser.prototype[postImplementation, getImplementation, putImplementation, patchImplementation, deleteImplementation, ...] */
    /* TestUser.prototype[postImage, getImage, putImage, patchImage, deleteImage, ...] */
    var modelUrlMap = {
      User          : '/users',
      Container     : '/users/me/runnables',
      Specification : '/specifications',
      Implementation: '/users/me/implementations',
      Image         : '/runnables'
    };
    var modelMethod = function (baseUrl) {
      return function (id, opts, callback) {
        if (typeof id === 'object') {
          callback = opts;
          opts = id;
          id = '';
        }
        if (typeof opts === 'function') {
          callback = opts;
          opts = {};
        }
        var path = p.join('/', baseUrl, id);
        if (!callback) {
          return this[method](path, opts);
        }
        else {
          this[method](path, opts, async.pick('body', callback));
        }
      };
    };
    Object.keys(modelUrlMap).forEach(function (modelName) {
      var baseUrl = modelUrlMap[modelName];
      TestUser.prototype[method + modelName] = modelMethod(baseUrl);
      if (method === 'get') {
        TestUser.prototype[method + modelName + 's'] = TestUser.prototype[method + modelName];
      }
    });
  });
// path args ... [query] [callback]
TestUser.prototype.specRequest = function () {
  if (typeof this.requestStr !== 'string') {
    throw new Error('spec request was not found');
  }
  var reqsplit = this.requestStr.split(' ');
  var method = reqsplit[0].toLowerCase();
  var path   = reqsplit[1];

  var args = Array.prototype.slice.call(arguments);
  args.forEach(function (i) { // filter out undef/null
    if (i === null || i === undefined) {
      var err = new Error('specRequest: invoked with undefined args [ '+ args +' ]');
      console.error(err.message);
      throw err;
    }
  });
  var query, callback;
  if (typeof args[args.length - 1] === 'function') {
    callback = args.pop();
  }
  if (_.isObject(args[args.length - 1])) {
    query = args.pop();
  }
  // replace url params
  var pathArgRegExp = /(\/):[^\/]*/;
  args.forEach(function (arg) {
    path = path.replace(pathArgRegExp, '$1'+arg);
  });
  if (pathArgRegExp.test(path)) {
    throw new Error('specRequest: missing args');
  }
  // make sure describe has an http method
  if (typeof this[method] !== 'function') {
    console.error('specRequest: check your describes, "' +method+ '" is not an http method');
  }
  var opts = _.isEmpty(query) ? {} : { qs:query };
  return this[method](path, opts, callback);
};

TestUser.prototype.register = function (auth) {
  return this.put('/users/me')
    .send(auth)
    .expect(200)
    .expectBody('_id');
};
TestUser.prototype.dbUpdate = function (updateSet, cb) {
  var self = this;
  var oid = require('mongodb').ObjectID;
  var userId = oid.createFromHexString(this._id);
  db.users.update({_id:userId}, { $set: updateSet }, function (err, docsUpdated) {
    err = err || (docsUpdated === 0 && new Error('db update failed, user not found'));
    if (err) {
      return cb(err);
    }
    _.extend(self, updateSet);
    cb();
  });
};
TestUser.prototype.createImage = function (from, callback) {
  this.postImage({ qs: { from: from } })
    .expect(201)
    .end(async.pick('body', callback));
};
TestUser.prototype.createImageFromFixture = function (name, imageName, callback) {
  if (typeof imageName === 'function') {
    callback = imageName;
    imageName = null;
  }
  imageName = imageName || name;
  if (this.permission_level < 3) {
    return callback(new Error('only publishers and admin users can create images from fixtures'));
  }
  var path = p.join(__dirname, '/fixtures/images/', name);
  fstream.Reader({
    path: path,
    type: 'Directory',
    mode: '0755'
  }).pipe(tar.Pack())
    .pipe(zlib.createGzip())
    .pipe(this.post('/runnables/import?name=' + imageName)
      .set('content-type', 'application/x-gzip')
      .expect(201)
      .streamEnd(async.pick('body', callback)));
};
TestUser.prototype.createContainer = function (from, body, callback) {
  if (typeof body === 'function') {
    callback = body;
    body = null;
  }
  return this.post('/users/me/runnables?from=' + from)
    .send(body || {})
    .expect(201)
    .end(async.pick('body', callback));
};
TestUser.prototype.createContainerFromFixture = function (name, imageName, callback) {
  var self = this;
  async.waterfall([
    function (cb) {
      self.createImageFromFixture(name, imageName, cb);
    },
    function (image, cb) {
      self.createContainer(image._id, cb);
    }
  ], callback);
};
TestUser.prototype.createSpecification = function (body, callback) {
  if (typeof body === 'function') {
    callback = body;
    body = null;
  }
  body = body || {};
  body = _.extend(helpers.specData(),  { name: 'name-'+uuid.v4() }, body);
  this.postSpecification({
    body: body,
    expect: 201
  }, callback);
};
TestUser.prototype.createImplementation = function (spec, containerId, callback) {
  var body = _.extend(helpers.implData(spec, containerId));
  this.postImplementation({
    body: body,
    expect: 201
  }, callback);
};
TestUser.prototype.tagContainerWithChannel = function (containerId, channelName, callback) {
  containerId = containerId._id || containerId;
  channelName = channelName.name || channelName;
  var url = p.join('/users/me/runnables/', containerId, 'tags');
  this.post(url)
    .send({ name: channelName })
    .expect(201)
    .end(async.pick('body', callback));
};
TestUser.prototype.createTaggedImage = function (fixtureName, channelNames, callback) {
  if (channelNames && !Array.isArray(channelNames)) {
    channelNames = [channelNames];
  }
  var self = this;
  var containerId;
  async.waterfall([
    this.createContainerFromFixture.bind(this, fixtureName, fixtureName+helpers.randomValue()),
    function (container, cb) {
      async.map(channelNames, function (channelName, cb) {
        self.tagContainerWithChannel(container, channelName, cb);
      },
      function (err) {
        cb(err, container);
      });
    },
    function (container, cb) { // rename container to prevent image name conflict
      self.patchContainer(container._id, { name: fixtureName+helpers.randomValue() }, cb);
    },
    function (container, cb) {
      self.createImage(container._id, cb); // TODO: change to publish back..
    }
  ], callback);
};
TestUser.prototype.removeAllContainerTags = function (container, callback) {
  var user = this;
  async.forEach(container.tags, function (tag, cb) {
    user.del('/users/me/runnables/'+container._id+'/tags/'+tag._id)
      .expect(200)
      .end(cb);
  }, callback);
};
