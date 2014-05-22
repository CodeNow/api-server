var configs = require('configs');
var api_server = require('index');

if (configs.nodetime) {
  var nodetime = require('nodetime');
  nodetime.profile(configs.nodetime);
}

if (configs.newrelic) {
  require('newrelic');
}

var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
    startServer();
  });

} else {
  startServer();
}

var startServer = function() {
  var worker = new api_server();
  worker.start(function noop () {});
};
