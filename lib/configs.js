var eson = require('eson');
var os = require('os');
var path = require('path');
var uuid = require('node-uuid');
var env = process.env.NODE_ENV || 'development';
function readConfigs (filename) {
  var config = eson()
    .use(eson.ms)
    .use(eson.replace('{ROOT_DIR}', path.normalize(__dirname + '/..')))
    .use(eson.replace('{RAND_NUM}', uuid.v4().split('-')[0]))
    .use(eson.replace('{HOME_DIR}', process.env.HOME))
    .use(eson.replace('{CURR_DIR}', __dirname + '/../configs'))
    .use(eson.replace('{RAND_DIR}', os.tmpDir() + '/' + uuid.v4()))
    .read(__dirname + '/../configs/' + filename + '.json');

  // throws error if config value does not exist
  var checkConfigs = [
    config.tokenExpires,
    config.passwordSalt,
    config.mongo,
    config.redis,
    config.redis.ipaddress,
    config.redis.port,
    config.workerRestartTime,
    config.newrelic,
    config.port,
    config.ipaddress,
    config.maxPageLimit,
    config.defaultPageLimit,
    config.rollbar,
    config.dockerRegistry,
    config.logExpress,
    config.throwErrors,
    config.adminAuth,
    config.adminAuth.email,
    config.adminAuth.password,
    config.cleanInterval,
    config.cacheRefreshInterval,
    config.containerTimeout,
    config.domain,
    config.mailchimp,
    config.mailchimp.key,
    config.mailchimp.lists,
    config.mailchimp.lists.publishers,
    config.mailchimp.lists.contact,
    config.SES,
    config.SES.sendMail,
    config.container,
    config.container.binds,
    config.container.bindFolder,
    config.container.portSpecs,
    config.container.portBindings,
    config.container.portBindings["80/tcp"],
    config.container.portBindings["15000/tcp"],
    config.container.cmd,
    config.frontdoor,
    config.frontdoor.protocol,
    config.frontdoor.hostname,
    config.frontdoor.port
  ];
  checkConfigs.forEach(function(i, index) {
    if(typeof i === 'undefined') {
      throw new Error("config not found in checkConfigs at index: "+index);
    }
  });

  if(config.SES.sendMail !== false) {
    var checkSESConfigs = [
      config.SES.auth,
      config.SES.auth.username,
      config.SES.auth.password,
      config.SES.from,
      config.SES.replyTo,
      config.SES.moderators
    ];

    checkSESConfigs.forEach(function(i, index){
      if(typeof i === 'undefined') {
        throw new Error("config not found in checkSESConfigs at index: "+index);
      }
    });
  }

  return config;
}

module.exports = readConfigs(env);
module.exports.readConfigs = readConfigs;
