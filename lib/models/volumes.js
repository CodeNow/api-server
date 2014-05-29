var async = require('async');
var utils = require('middleware/utils');
var configs = require('configs');
var error = require('error');
var request = require('request');
var exts = require('extensions');
var pathModule = require('path');
if (configs.dockworkerProxy) {
  request = request.defaults({
    proxy: configs.dockworkerProxy
  });
}

function formatURl(container, path, name, isDir) {
  var dir = isDir ? '/' : '';
  return 'http://' +
    container.host +
    ':' +
    configs.krainPort +
    pathModule.join(container.file_root, path, name) +
    dir;
}

function createRequeset(method, container, path, name, isDir, opts) {
  var req = {};
  req.url = formatURl(container, path, name, true);
  req.method = method;
  req.json = {};
  if(opts && typeof opts.body === 'object')  {
    req.json = opts.body;
  }
  req.json.container = {
    root: container.containerId
  };
  if (opts && typeof opts.query === 'object') {
    req.qs(opts.query);
  }
  return req;
}
var volumes = {
  createFs: function (container, data, cb) {
    var opts = null;
    if (!data.dir) {
      opts = {
        body: {
          content: data.content
        }
      };
    }
    // This request handles creating both files and dirs
    // Useing POST because it will return error if file exists
    console.log("createFs", container.containerId, data.path, data.name, data.dir, opts);
    request(
      createRequeset('POST', container, data.path, data.name, data.dir, opts),
      function (err, res) {
        if (err) {
          cb(err);
        } else if (res.statusCode === 502) {
          cb(error(500, 'runnable not responding to file requests'));
        } else if (res.statusCode !== 201) {
          cb(error(res.statusCode, 'unknown error response from runnable'));
        } else {
          cb();
        }
      });
  },
  streamFile: function (container, name, path, stream, cb) {
    console.log("streamFile", container.containerId, path, name);
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    var r = request({
      pool: false,
      url: 'http://' + subDomain + '.' + configs.domain + '/api/files/stream',
      method: 'POST'
    });
    var form = r.form();
    form.append('dir', srcDir);
    form.append('name', name);
    form.append('path', path);
    form.append('content', stream);
    r.on('error', cb);
    r.on('response', function (res) {
      if (res.statusCode === 502) {
        cb(error(500, 'runnable not responding to file requests'));
      } else if (res.statusCode !== 200) {
        cb(error(res.statusCode, 'unknown error response from runnable'));
      } else {
        cb();
      }
    });
    stream.resume();
  },
  readFile: function (container, name, path, cb) {
    console.log("readfile", container.containerId, path, name);
    request(
      createRequeset('POST', container, path, name, false),
      function (err, res) {
        if (err) {
          cb(err);
        } else if (res.statusCode === 502) {
          cb(error(500, 'runnable not responding to file requests'));
        } else if (res.statusCode !== 200) {
          cb(error(res.statusCode, 'unknown error response from runnable'));
        } else {
          cb(null, res.body);
        }
      });
  },
  updateFile: function (container, origData, newData, cb) {
    var file = origData;
    async.series([
      function (cb) {
        if (!utils.exists(newData.name)) {
          return cb();
        }
        volumes.renameFile(container, file.name, file.path, newData.name, cb);
        file.name = newData.name;
      },
      function (cb) {
        if (!utils.exists(newData.path)) {
          return cb();
        }
        volumes.moveFile(container, file.name, file.path, newData.path, cb);
        file.path = newData.path;
      },
      function (cb) {
        if (!utils.exists(newData.content)) {
          return cb();
        }
        volumes.updateFileContent(container, file.name, file.path, newData.content, cb);
      }
    ],
    function (err, results) {
      cb(err); //ignore results
    });
  },
  updateFileContent: function (container, name, path, content, cb) {
    request(
      createRequeset('POST', container, path, name, false, {
        body: {
          content: content
        }
      }), function (err, res) {
        if (err) {
          cb(err);
        } else if (res.statusCode === 502) {
          cb(error(500, 'runnable not responding to file requests'));
        } else if (res.statusCode !== 200) {
          cb(error(res.statusCode, 'unknown error response from runnable'));
        } else {
          cb();
        }
      });
  },
  renameFile: function (container, name, path, newName, cb) {
    console.log("rename", name, path, newName);
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    request(
      createRequeset('POST', container, path, name, false, {
        body: {
          newPath: pathModule.join(container.file_root, path, newName)
        }
      }), function (err, res) {
        if (err) {
          cb(err);
        } else if (res.statusCode === 502) {
          cb(error(500, 'runnable not responding to file requests'));
        } else if (res.statusCode !== 200) {
          cb(error(res.statusCode, 'unknown error response from runnable'));
        } else {
          cb();
        }
      });
  },
  moveFile: function (container, name, path, newPath, cb) {
    console.log("moveFile", name, path, newPath);
    var subDomain = container.servicesToken;
    var srcDir = container.file_root;
    request(
      createRequeset('POST', container, path, name, false, {
        body: {
          newPath: pathModule.join(container.file_root, newPath)
        }
      }), function (err, res) {
        if (err) {
          cb(err);
        } else if (res.statusCode === 502) {
          cb(error(500, 'runnable not responding to file requests'));
        } else if (res.statusCode !== 200) {
          cb(error(res.statusCode, 'unknown error response from runnable'));
        } else {
          cb();
        }
      });
  },
  removeFs: function (container, data, cb) {
    var opts = null;
    if (data.dir) {
      opts = {
        body: {
          clobber: true
        }
      };
    }
    // This request handles deleting both files and dir
    console.log("removeFs", container.containerId, data.path, data.name, data.dir, opts);
    request(
      createRequeset('DELETE', container, data.path, data.name, data.dir, opts),
      function (err, res) {
        if (err) {
          cb(err);
        } else if (res.statusCode === 502) {
          cb(error(500, 'runnable not responding to file requests'));
        } else if (res.statusCode !== 200) {
          cb(error(res.statusCode, 'unknown error response from runnable'));
        } else {
          cb();
        }
      });
  },
  readAllFiles: function (container, cb) {
    request(
      createRequeset('GET', container, '', '', true,  {
        query: {
          recursive: "true"
        }
      }), function (err, res) {
        if (err) {
          cb(err);
        } else if (res.statusCode === 502) {
          cb(error(500, 'runnable not responding to file requests'));
        } else if (res.statusCode !== 200) {
          cb(error(res.statusCode, 'unknown error response from runnable'));
        } else {
          cb(null, res.body);
        }
      });
  },
  readDirectory: function (container, subDir, cb) {
    request(
      createRequeset('GET', container, subDir, '', true),
      function (err, res) {
        if (err) {
          cb(err);
        } else if (res.statusCode === 502) {
          cb(error(500, 'runnable not responding to file requests'));
        } else if (res.statusCode !== 200) {
          cb(error(res.statusCode, 'unknown error response from runnable'));
        } else {
          cb(null, res.body);
        }
      });
  }
};
module.exports = volumes;
