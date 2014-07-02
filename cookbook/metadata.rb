name             'runnable_api-server'
maintainer       'Runnable.com'
maintainer_email 'ben@runnable.com'
license          'All rights reserved'
description      'Installs/Configures api-server'
long_description IO.read(File.join(File.dirname(__FILE__), 'README.md'))
version          '0.1.8'

supports 'ubuntu'

depends 'runnable_nodejs'

depends 'apt'

recipe 'runnable_api-server::default', 'Performs installaion/configuration of api-server and all prerequisites'

attribute 'runnable_api-server/deploy_path',
  :display_name => 'deploy path',
  :description => 'The full directory path where api-server will be deployed',
  :type => 'string',
  :default => '/opt/api-server'

attribute 'runnable_api-server/newrelic/application_id',
  :display_name => 'newrelic application_id',
  :description => 'The New Relic application ID to be used when tracking deployments',
  :type => 'string',
  :default => nil
