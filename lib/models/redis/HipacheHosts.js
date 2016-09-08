var configs = require('configs');
var redis = require('models/redis');
var url = require('url');

module.exports = HipacheHosts;

function HipacheHosts () {
  this.redis = redis;
}

HipacheHosts.prototype.routeContainerToFrontdoor = function (container, dockIp, cb) {
  var strData = JSON.stringify({
    servicesToken: container.servicesToken,
    startUrl: container.getStartUrl(),
    host: dockIp,
    servicesPort: null,
    webPort: null
  });
  var serviceKey = ['frontend:', container.servicesToken, '.', configs.userContentDomain].join('');
  var webKey = ['frontend:', container.webToken, '.', configs.userContentDomain].join('');

  var frontdoorUrl = url.format(configs.frontdoor);
  redis.multi()
    .rpush(serviceKey, strData, frontdoorUrl)
    .rpush(webKey, strData, frontdoorUrl)
    .exec(cb);
};

HipacheHosts.prototype.addContainerPorts = function (container, cb) {
  var containerStartTime = new Date();
  containerExpiryTime = new Date(containerStartTime.getTime() + (configs.container.defaultExpiry * 1000));

  var strData = JSON.stringify({
    servicesToken: container.servicesToken,
    startUrl: container.getStartUrl(),
    host: container.host,
    servicesPort: container.servicesPort,
    webPort: container.webPort,
    startTime: containerStartTime,
    expiryTime: containerExpiryTime
  });
  var serviceKey = ['frontend:', container.servicesToken, '.', configs.userContentDomain].join('');
  var webKey = ['frontend:', container.webToken, '.', configs.userContentDomain].join('');

  var frontdoorUrl = url.format(configs.frontdoor);

  redis.multi()
    .lset(serviceKey, 0, strData)
    .lset(webKey, 0, strData)
    .exec(cb);
};

HipacheHosts.prototype.removeContainerPorts = function (container, cb) {
  var serviceKey = ['frontend:', container.servicesToken, '.', configs.userContentDomain].join('');
  var webKey = ['frontend:', container.webToken, '.', configs.userContentDomain].join('');

  redis.multi()
    .del(serviceKey)
    .del(webKey)
    .exec(cb);
};

HipacheHosts.prototype.extendContainerLife = function (container, cb) {
  var serviceKey = ['frontend:', container.servicesToken, '.', configs.userContentDomain].join('');
  var webKey = ['frontend:', container.webToken, '.', configs.userContentDomain].join('');

  var currentTime = new Date();
  containerNewExpiryTime = new Date(currentTime.getTime() + (configs.container.defaultExpiryExtension * 1000));

  redis.lrange(serviceKey, 0, 0, function(err, reply) {
    serviceData = JSON.parse(reply[0]);
    serviceData.expiryTime = containerNewExpiryTime;
    var strData = JSON.stringify(serviceData);

    redis.multi()
    .lset(serviceKey, 0, strData)
    .lset(webKey, 0, strData)
    .exec(cb);
  });
};

HipacheHosts.prototype.howMuchLife = function (container, cb) {
  var serviceKey = ['frontend:', container.servicesToken, '.', configs.userContentDomain].join('');

  var currentTime = new Date();
  redis.lrange(serviceKey, 0, 0, function(err, reply) {
    serviceData = JSON.parse(reply[0]);
    // remaingTime = serviceData.expiryTime.getTime() - currentTime.getTime();
    console.log('Remaining Time: ', remaingTime);
    
    cb(err, reply);
  });

};

HipacheHosts.prototype.killContainer = function (container, cb) {
  var serviceKey = ['frontend:', container.servicesToken, '.', configs.userContentDomain].join('');
  var webKey = ['frontend:', container.webToken, '.', configs.userContentDomain].join('');

  redis.multi()
    .del(serviceKey)
    .del(webKey)
    .exec(cb);
};

HipacheHosts.prototype.listDocklets = function (cb) {
  var dockletKey = ['frontend:', 'docklet', '.', configs.domain].join('');
  redis.lrange(dockletKey, 1, -1, function(err, reply) {
    cb(err, reply);
  });
};

