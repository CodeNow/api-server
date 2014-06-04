name             'runnable_api-server'
maintainer       'Runnable.com'
maintainer_email 'ben@runnable.com'
license          'All rights reserved'
description      'Installs/Configures api-server'
long_description IO.read(File.join(File.dirname(__FILE__), 'README.md'))
version          '0.1.1'

supports 'ubuntu'

depends 'runnable_base'
depends 'apt'
depends 'build-essential'
depends 'nodejs'
depends 'sudo'
depends 'user'

recipe 'runnable_api-server::default', 'Performs installaion/configuration of api-server and all prerequisites'

attribute 'runnable_api-server/deploy/deploy_branch'
  display_name: 'api-server git branch',
  description: 'The branch of the api-server git repository which will be deployed',
  type: 'string',
  default: 'master'

attribute 'runnable_api-server/deploy/deploy_to'
  display_name: 'deploy directory',
  description: 'The target directory where api-server will be deployed',
  type: 'string',
  default: '/home/ubuntu/api-server'

attribute 'runnable_api-server/deploy/deploy_user'
  display_name: 'api-server deploy user',
  description: 'The user which will run api-server',
  type: 'string',
  default: 'ubuntu'

attribute 'runnable_api-server/newrelic/application_id'
  display_name: 'newrelic application_id',
  description: 'The New Relic application ID to be used when tracking deployments',
  type: 'string',
  default: nil
