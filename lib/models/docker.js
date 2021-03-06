var configs = require('configs');
var keypather = require('keypather')();
var Dockerode = require('dockerode');
var containerOpts = configs.container;
var error = require('error');
var url = require('url');
var dogerode = require('dogerode');

module.exports = Docker;

function Docker (host) {
  var parsed = ~host.indexOf('http:') ?
    url.parse(host) :
    url.parse('http://'+host);
  this.docker = dogerode(new Dockerode({
    host: parsed.protocol +'//'+ parsed.host,
    port: parsed.port || 4243
  }), {
    service: 'api'
  });
}

Docker.prototype.listContainers = function (cb) {
  this.docker.listContainers( function(err, data) {
    cb(err, data);
  });
};

Docker.prototype.createContainer = function (image, container, cb) {
  var servicesToken = container.servicesToken;
  var webToken = container.webToken;

  var Volumes = {};
  Volumes[containerOpts.bindFolder] = {};
  var opts = {
    Volumes  : Volumes,
    Cmd      : containerOpts.cmd,
    Env      : container.getEnv(),
    PortSpecs: containerOpts.portSpecs,
    Tty      : true,
    Hostname : 'runnable',
    Image    : image.getRepo(),
    ExposedPorts : containerOpts.exposedPorts,
    Binds: containerOpts.binds,
    PortBindings: containerOpts.portBindings,
    BlkioDeviceReadBps  : containerOpts.blkioDeviceReadBps,
    BlkioDeviceWriteBps  : containerOpts.blkioDeviceWriteBps,
    BlkioDeviceReadIOps  : containerOpts.blkioDeviceReadIOps,
    BlkioDeviceWriteIOps  : containerOpts.blkioDeviceWriteIOps,
    CpusetCpus  : containerOpts.cpusetCpus,
    CpuPeriod : containerOpts.cpuPeriod,
    CpuQuota : containerOpts.cpuQuota,
    KernelMemory  : containerOpts.kernelMemory,
    MemoryReservation  : containerOpts.memoryReservation,
    Memory  : containerOpts.memory,
    MemorySwap  : containerOpts.memorySwap
  };
  this.docker.createContainer(opts, cb);
};

Docker.prototype.startContainer = function (containerId, cb) {
  containerId = containerId.slice(0, 12);
  this.docker.getContainer(containerId)
    .start(function(err, data) {
      console.log('startContainer', err, data);
      if(err && err.statusCode === 304) {
        return cb(null, "is already running");
      }
      cb(err, data);
    });
};

Docker.prototype.stopContainer = function (containerId, cb) {
  containerId = containerId.slice(0, 12);
  var opts = {
    t: 1 // stop delay in seconds
  };
  this.docker.getContainer(containerId)
    .stop(opts, cb);
};

Docker.prototype.removeContainer = function (containerId, cb) {
  containerId = containerId.slice(0, 12);
  var opts = {
    t: 1 // stop delay in seconds
  };
  this.docker.getContainer(containerId)
    .remove(opts, cb);
};

Docker.prototype.inspectContainer = function (containerId, cb) {
  containerId = containerId.slice(0, 12);
  this.docker.getContainer(containerId).inspect(cb);
};

Docker.prototype.commitContainer = function (container, cb) {
  var opts = {
    repo: configs.dockerRegistry+'/runnable/'+container._id // must be decoded - hex!!
  };
  var containerId = container.containerId.slice(0, 12);
  this.docker.getContainer(containerId)
    .commit(opts, cb);
};

Docker.prototype.pushRepoById = function (repoId, cb) {
  var repo = configs.dockerRegistry+'/runnable/'+repoId;
  var errored = false;
  this.docker.getImage(repo)
    .push({}, function (err, stream) {
      if (err) {
        cb(err);
      }
      else {
        stream.on('error', onError);
        stream.on('data', onData);
        stream.on('end', onEnd);
      }
      var jsonStr = '';
      var jsonErr;
      var json;
      function onError (err) {
        errored = err;
        cb(err);
      }
      function onData (chunk) {
        if (errored) { return; }
        try {
          json = JSON.parse(jsonStr + chunk);
          jsonStr = ''; // reset, json chunk ended
          jsonErr = null;
          if (json.error) {
            var errorDetail = json.errorDetail;
            onError(error(502, errorDetail.code+': '+errorDetail.message+' '+json.error));
          }
        }
        catch (err) {
          jsonErr = err;
          // ignore, just continue appending data to jsonStr
          // this asummes jsonStr will eventually be a parsable json string
          // which means that chunks containing a json-end ("}") will always end on the json-end
          jsonStr += chunk;
        }
      }
      function onEnd () {
        if (errored) { return; }
        if (jsonErr) {
          cb(jsonErr);
        }
        else {
          cb();
        }
      }
    });
};
