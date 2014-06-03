name             'runnable_api-server'
maintainer       'Runnable.com'
maintainer_email 'ben@runnable.com'
license          'All rights reserved'
description      'Installs/Configures api-server'
long_description IO.read(File.join(File.dirname(__FILE__), 'README.md'))
version          '0.1.1'

depends 'runnable_base'
depends 'nodejs'
depends 'sudo'
depends 'user'

recipe 'runnable_api-server::default', 'Performs installaion/configuration of api-server and all prerequisites'

