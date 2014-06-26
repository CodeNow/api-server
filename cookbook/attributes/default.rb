default['runnable_api-server']['deploy']['deploy_path']		= '/opt/api-server'
default['runnable_api-server']['newrelic']['application_id']	= nil

default['runnable_api-server']['deploy']['deploy_branch'] = case node.chef_environment
when 'integration', 'staging'
  'master'
when 'production'
  'release_branch'
end

