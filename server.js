var configs = require('configs');
var api_server = require('index');
var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

if (configs.nodetime) {
  var nodetime = require('nodetime');
  nodetime.profile(configs.nodetime);
}

if (configs.newrelic) {
  require('newrelic');
}

cluster.on('fork', function(worker) {
  console.log('CLUSTER: fork worker', worker.id);
});
cluster.on('listening', function(worker, address) {
  console.log('CLUSTER: listening worker', worker.id,
    'address', address.address + ":" + address.port);
});
cluster.on('exit', function(worker, code, signal) {
  console.log('CLUSTER: exit worker', worker.id, 'code', code, 'signal', signal);
  cluster.fork();
});
cluster.on('online', function(worker) {
  console.log('CLUSTER: online worker', worker.id);
});
cluster.on('disconnect', function(worker) {
  console.log('CLUSTER: disconnected worker' + worker.id);
});

if (cluster.isMaster) {
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  var worker = new api_server();
  worker.start(function (err) {
    if (err) {
      console.error("can not start");
    }
  });
}
