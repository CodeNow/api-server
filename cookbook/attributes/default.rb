default['runnable_api-server']['deploy_branch'] = 'master'
default['runnable_api-server']['deploy_path']		= '/opt/api-server'

default['runnable_api-server']['config'] = {
  'mongo' => 'mongodb://127.0.0.1:27017/runnable2',
  'tokenExpires' => '1 year',
  'passwordSalt' => '$up3r,$3<r3t',
  'workerRestartTime' => 3600000,
  'rollbar' => '',
  'domain' => '',
  'throwErrors' => true,
  'cleanInterval' => '2 minutes',
  'cacheRefreshInterval' => '2 minutes',
  'redis' => {
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
    'port' => 7050
  },
  'SES' => {
    'sendMail' => false
  }
}