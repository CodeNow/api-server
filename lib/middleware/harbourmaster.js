var Harbourmaster = require('models/harbourmaster');
var utils = require('middleware/utils');
var configs = require('configs');
var docklet = require('middleware/docklet');
var docker  = require('middleware/docker');
var events  = require('middleware/events');
var hipacheHosts  = require('middleware/hipacheHosts');
var flow = require('middleware-flow');
var series = flow.series;
var mwIf = flow.mwIf.bind(flow);
var syncIf = flow.syncIf.bind(flow);
var pluck = require('101/pluck');
var keypather = require('keypather')();
var redis = require('models/redis');
var exists = require('101/exists');

var harbourmaster = module.exports = {
  createContainer: function (imageKey, containerKey) {
    var containers = require('middleware/containers');
    return series(
      docklet.create(),
      docklet.model.findDockWithImage(imageKey, 'container.servicesToken'),
      docker.create('dockletResult'),
      docker.model.createContainer(imageKey, containerKey),
      containers.model.set({
        containerId: 'dockerResult.id',
        host: 'dockletResult'
      }), // save occurs later
      storeIP
    );

    function storeIP (req, res, next) {
      req.container.create_ip = req.headers['x-real-ip'];
      next();
    }
  },

  startContainer: function (containerKey) {
    var containers = require('middleware/containers');
    return series(
      docker.create('container.host'),
      docker.model.startContainer('container.containerId'),
      docker.model.inspectContainer('container.containerId'),
      containers.model.set({
        servicesPort: "dockerResult.NetworkSettings.Ports['15000/tcp'][0].HostPort",
        webPort: "dockerResult.NetworkSettings.Ports['80/tcp'][0].HostPort"
      }),
      containers.model.save()
    );
  },

  stopContainer: function (containerKey) {
    return series(
      docker.create('container.host'),
      docker.model.stopContainer('container.containerId')
    );
  },

  extendContainerLife: function (containerKey) {
    return series(
      hipacheHosts.create(),
      hipacheHosts.model.extendContainerLife(
        'container')
    );
  },

  killContainer: function (containerKey) {
    return series(
      docker.create('container.host'),
      docker.model.stopContainer('container.containerId'),
      docker.model.removeContainer('container.containerId')
    );
  },

  // Same as killContiner, Ignoring errors in large wipes
  wipeContainer: function (container) {
    var flow = require('middleware-flow');
    return series(
      docker.create(container.host),
      flow.try(docker.model.stopContainer(container.containerId)).catch(
            console.log('Unhandled exception for contianer stop')
      ),
      flow.try(docker.model.removeContainer(container.containerId)).catch(
              console.log('Unhandled exception for contianer remove')
        )
    );
  },

  howMuchLife: function (containerKey) {
    return series(
      hipacheHosts.create(),
      hipacheHosts.model.howMuchLife(
        'container')
    );
  },

  setTermAccess: function (containerKey) {
    return series(
      hipacheHosts.create(),
      hipacheHosts.model.setTermAccess(
        'container')
    );
  },

  listDocklets: function (containerKey) {
    return series (
      hipacheHosts.create(),
      hipacheHosts.model.listDocklets()
    );
  },

  // cleanupContainers: function (containersKey) {
  //   return function (req, res, next) {
  //     var containers = keypather.get(req, containersKey);
  //     var containerIds = containers
  //       .map(pluck('containerId'))
  //       .filter(exists)
  //       .map(invoke('slice', 0, 12)); // docklet expects container ids of length 12
  //     redis.publish('dockletPrune', JSON.stringify(containerIds));
  //     next();
  //   };
  // }

  commitContainer: function (containerKey) {
    var containers = require('middleware/containers');
    var images = require('middleware/images');
    var committingNew = function (req) {
      return req.body.status === 'Committing new';
    };
    return mwIf(series(
      containers.model.setAndSave({ status: 'Stopping Virtual Machine' }),
      events.containerStatusEvent('container'),
      harbourmaster.stopContainer(containerKey),
      containers.model.setAndSave({ status: 'Saving Changes' }),
      events.containerStatusEvent('container'),
      docker.create('container.host'),
      docker.model.commitContainer('container'),
      containers.model.setAndSave({ status: 'Optimizing' }),
      events.containerStatusEvent('container'),
      docklet.create('container.host', 4244),
      docklet.model.addImageRepoById('container._id'),
      containers.model.setAndSave({ status: 'Distributing' }),
      events.containerStatusEvent('container'),
      docker.model.pushRepoById('container._id'),
      syncIf(committingNew)
        .then( // publish new
          images.createFromContainer('container'),
          utils.code(200) // override 201
        )
        .else( // publish back
          images.find('container.parent'),
          images.checkFound,
          images.updateImageFromContainer('image', 'container')
        ),
      containers.model.setAndSave({ status: 'Finished' }),
      events.containerStatusEvent('container')
    )).else(
      containers.model.setAndSave({
        commit_error: 'lastError'
      }),
      harbourmaster.startContainer(containerKey), // restart container, commit failed
      nextLastError
    );
  },

  cleanupContainers: function (containersKey) {
    return function (req, res, next) {
      var containers = keypather.get(req, containersKey);
      var containerIds = containers
        .map(pluck('containerId'))
        .filter(exists)
        .map(invoke('slice', 0, 12)); // docklet expects container ids of length 12
      redis.publish('dockletPrune', JSON.stringify(containerIds));
      next();
    };
  }
};

function nextLastError (req, res, next) {
  next(req.lastError);
}

function invoke (method /*, args */) {
  var args = Array.prototype.slice.call(arguments, 1);
  return function (item) {
    return item[method].apply(item, args);
  };
}