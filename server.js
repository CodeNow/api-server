var configs = require('configs');
var cluster = require('cluster');
var path = require('path');
var workers = {};
var rollbar = require('rollbar');
var numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  attachLogs(cluster);
  initExternalServices();

  process.on('uncaughtException', masterHandleException);
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    var worker = cluster.fork();
    workerHandleExeption(worker);
  }
} else {
  var api_server = require('index');
  var apiServer = new api_server();
  apiServer.start(function(err) {
    if (err) {
      console.error("can not start", err);
    }
  });
}

var attachLogs = function(clusters) {
  clusters.on('fork', function(worker) {
    console.log('CLUSTER: fork worker', worker.id);
  });
  clusters.on('listening', function(worker, address) {
    console.log('CLUSTER: listening worker', worker.id,
      'address', address.address + ":" + address.port);
  });
  clusters.on('exit', function(worker, code, signal) {
    console.log('CLUSTER: exit worker', worker.id, 'code', code, 'signal', signal);
    clusters.fork();
  });
  clusters.on('online', function(worker) {
    console.log('CLUSTER: online worker', worker.id);
  });
  clusters.on('disconnect', function(worker) {
    console.log('CLUSTER: disconnected worker' + worker.id);
  });
};

var initExternalServices = function() {
  if (configs.nodetime) {
    var nodetime = require('nodetime');
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
  function killAndStartNewWorker (message) {
    for (var worker in cluster.workers) {
      break;
    }
    cluster.fork();
    console.log('CLUSTER: workaround Killing worker', worker.id);
    worker.disconnect();
    worker.on('error', function(err) {
      rollbar.handleError(err);
      console.log("error on disconnect", err);
    });
  }
};

var workerHandleException = function(worker) {
  worker.process.on('uncaughtException', function() {
    console.error('WORKER: uncaughtException:', err);
    rollbar.handleError(err);
    worker.process.exit(1);
  });
};

var masterHandleException = function(err) {
  process.on('uncaughtException', function() {
    if (configs.nodetime) {
      nodetime.destroy();
    }
    if (configs.rollbar) {
      rollbar.shutdown();
    }
    console.error('MASTER: uncaughtException:', err);
    rollbar.handleError(err);
    process.exit();
  });
};
