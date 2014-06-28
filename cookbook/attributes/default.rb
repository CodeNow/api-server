default['runnable_api-server']['deploy_path']		= '/opt/api-server'
default['runnable_api-server']['newrelic']['application_id']	= nil

default['runnable_api-server']['deploy_branch'] = case node.chef_environment
when 'integration', 'staging'
  'master'
when 'production'
  'release_branch'
end

mongo_server      = search(:node, "chef_environment:#{node.chef_environment} AND recipes:runnable\:\:mongo_server").first
redis_server      = search(:node, "chef_environment:#{node.chef_environment} AND recipes:runnable\:\:redis_server").first
frontdoor_server  = search(:node, "chef_environment:#{node.chef_environment} AND recipes:runnable\:\:frontdoor").first

case chef_environment
when 'integration'
  default['runnable_api-server']['config']['workerRestartTime'] => 3600000
  default['runnable_api-server']['config']['rollbar'] => '119509f9ba314df8a9ffbaf7b4812fb6'
  default['runnable_api-server']['config']['throwErrors'] => true
  default['runnable_api-server']['config']['cleanInterval'] => '2 minutes'
  default['runnable_api-server']['config']['cacheRefreshInterval'] => '2 minutes'
  default['runnable_api-server']['config']['domain'] => 'cloudcosmos.com'
  default['runnable_api-server']['config']['SES'] => {
    'sendMail' => false
  }
when 'staging'
  default['runnable_api-server']['config']['workerRestartTime'] => 60000
  default['runnable_api-server']['config']['rollbar'] => '119509f9ba314df8a9ffbaf7b4812fb6'
  default['runnable_api-server']['config']['throwErrors'] => false
  default['runnable_api-server']['config']['cleanInterval'] => '3 hours'
  default['runnable_api-server']['config']['cacheRefreshInterval'] => '60 minutes'
  default['runnable_api-server']['config']['domain'] => 'runnable.pw'
  default['runnable_api-server']['config']['SES]' => {
    'sendMail': true,
    'auth' => {
      'username' => 'AKIAIEPR357KCGSMAQAQ',
      'pass' => 'Ag/xsyJ047+LTH3RNfmPG7JXR9b0yaeto2TyzuonjtjH'
    },
    'from' => 'Feedback <feedback@runnable.com>',
    'replyTo' => 'Feedback <feedback@runnable.mail.intercom.io>',
    'to' => 'support+staging@runnable.com'
  }

when 'production'
  default['runnable_api-server']['config']['workerRestartTime'] => 3600000
  default['runnable_api-server']['config']['rollbar'] => 'f35b40b711d246bda76a23d1cda74d5b'
  default['runnable_api-server']['config']['throwErrors'] => false
  default['runnable_api-server']['config']['cleanInterval'] => '3 hours'
  default['runnable_api-server']['config']['cacheRefreshInterval'] => '60 minutes'
  default['runnable_api-server']['config']['domain'] => 'runnable.com'
  default['runnable_api-server']['config']['SES]' => {
    'sendMail': true,
    'auth' => {
      'username' => 'AKIAIEPR357KCGSMAQAQ',
      'pass' => 'Ag/xsyJ047+LTH3RNfmPG7JXR9b0yaeto2TyzuonjtjH'
    },
    'from' => 'Feedback <feedback@runnable.com>',
    'replyTo' => 'Feedback <feedback@runnable.mail.intercom.io>',
    'moderators' => 'moderators@runnable.com'
  }

  default['runnable_api-server']['config']['newrelic'] => {
    'name' => 'api-production',
    'key' => '338516e0826451c297d44dc60aeaf0a0ca4bfead'
  }
end



default['runnable_api-server']['config'] = {
  'tokenExpires' => '1 year',
  'passwordSalt' : '$up3r,$3<r3t',
  'mongo' => "mongodb://#{mongo_server.ipaddress}:27017/runnable2"
  'redis' => {
    'ipaddress' => redis_server.ipaddress,
    'port' => '6379'
  },

  'port' => 3000,
  'ipaddress' => node.ipaddress,
  'maxPageLimit' => 200,
  'defaultPageLimit' => 25,
  'dockerRegistry' => 'registry.runnable.com',
  'logExpress' => true,
  'adminAuth' => {
    'email' => 'tjadmin',
    'password' => 'mehta'
  },
  'containerTimeout' => '5 minutes',
  'mailchimp' => {
    'key' =>  '5fb2e67f84c1be89cf4ddf2252fc3de3-us5',
    'lists' => {
      'publishers' => 'b7a679ddc3',
      'contact' => '43330e29a9'
    }
  },
  'container' => {
    'binds' => ['/home/ubuntu/dockworker:/dockworker:ro'],
    'bindFolder' => '/dockworker',
    'portSpecs' => [
      '80',
      '15000'
    ],
    'portBindings' => {
      '80/tcp' => [{}],
      '15000/tcp' => [{}]
    },
    'cmd' => ['/dockworker/bin/node', '/dockworker']
  },
  'frontdoor' => {
    'protocol' => 'http:',
    'hostname' => frontdoor_server.ipaddress,
    'port' => 7050
  }
}
