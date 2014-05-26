var configs = require('configs');
var cluster = require('cluster');
var path = require('path');
var rollbar = require('rollbar');
var numCPUs = require('os').cpus().length;
var nodetime = require('nodetime');
var pluck = require('map-utils').pluck;
var workers;

var createWorker = function() {
  var worker = cluster.fork();
  worker.process.on('uncaughtException', function(err) {
    console.error(new Date(), 'WORKER: uncaughtException:', err);
    rollbar.handleError(err);
    worker.process.exit(1);
  });
  workers.push(worker);
  console.log(new Date(), 'CLUSTER: create new worker', worker.id);
  return worker;
};

var attachLogs = function(clusters) {
  clusters.on('fork', function(worker) {
    console.log(new Date(), 'CLUSTER: fork worker', worker.id);
  });
  clusters.on('listening', function(worker, address) {
    console.log(new Date(), 'CLUSTER: listening worker', worker.id,
      'address', address.address + ":" + address.port);
  });
  clusters.on('exit', function(worker, code, signal) {
    console.log(new Date(), 'CLUSTER: exit worker', worker.id, 'code', code, 'signal', signal);
    workers.map(pluck('id')).some(function (workerId, i) {
      if (workerId === worker.id) {
        workers.splice(i, 1); // remove worker from workers
      }
    });
    createWorker();
  });
  clusters.on('online', function(worker) {
    console.log(new Date(), 'CLUSTER: online worker', worker.id);
  });
  clusters.on('disconnect', function(worker) {
    console.log(new Date(), 'CLUSTER: disconnected worker', worker.id, "killing now");
    worker.kill();
  });
};

var initExternalServices = function() {
  if (configs.nodetime) {
    nodetime.profile(configs.nodetime);
  }
  if (configs.newrelic) {
    require('newrelic');
  }
  if (configs.rollbar) {
    rollbar.init(configs.rollbar, {
      environment: process.env.NODE_ENV || "development",
      branch: "master",
      root: path.resolve(__dirname, '..')
    });
  }
};

var memoryLeakPatch = function() {
  // memory leak patch! - start restart timeout
  setInterval(killAndStartNewWorker, configs.workerRestartTime);
  var onError = function(err) {
    rollbar.handleError(err);
    console.log(new Date(), "CLUSTER: error on disconnect", err);
  };
  function killAndStartNewWorker () {
    var worker = workers.shift();
    var drainTime = 60000;
    setTimeout(function() {
      console.log('new Date(), "CLUSTER: Killing old worker', worker.id);
    }, drainTime);
    console.log(new Date(), 'CLUSTER: workaround Killing worker', worker.id);
    worker.disconnect();
    worker.on('error', onError);
  }
};

var masterHandleException = function(err) {
  process.on('uncaughtException', function() {
    if (configs.nodetime) {
      nodetime.destroy();
    }
    if (configs.rollbar) {
      rollbar.shutdown();
    }
    console.error(new Date(), 'MASTER: uncaughtException:', err);
    rollbar.handleError(err);
    process.exit();
  });
};

if (cluster.isMaster) {
  attachLogs(cluster);
  initExternalServices();
  masterHandleException();
  // Fork workers.
  workers = [];
  for (var i = 0; i < numCPUs; i++) {
    createWorker();
  }
  memoryLeakPatch();
} else {
  var api_server = require('index');
  var apiServer = new api_server();
  apiServer.start(function(err) {
    if (err) {
      console.error(new Date(), "can not start", err);
    }
  });
}
