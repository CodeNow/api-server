require 'minitest/spec'

describe_recipe 'runnable_api-server::default' do

  include MiniTest::Chef::Assertions
  include Minitest::Chef::Context
  include Minitest::Chef::Resources
  include Chef::Mixin::ShellOut

  it 'installs nodejs v0.10.28' do
    node_version = shell_out('node --version')
    assert_equal("v0.10.28\n", node_version.stdout, "Incorrect node version present: #{node_version.stdout}")
  end

  it 'creates github ssh deploy key files' do
    file('/root/.ssh/runnable_api-server').must_exist
    file('/root/.ssh/runnable_api-server.pub').must_exist
  end

  it 'generates json configuration' do
    assert_includes_content("#{node['runnable_api-server']['deploy_path']}/current/configs/#{node.chef_environment}.json", node['runnable_api-server']['config'].to_json)
  end

  it 'creates api-server upstart service' do
    file('/etc/init/api-server.conf').must_exist
  end

  it 'creates cleanup upstart service' do
    file('/etc/init/cleanup.conf').must_exist
  end

  it 'starts api-server service' do
    shell_out('service api-server status').stdout.must_match(/^api-server start\/running, process [0-9]*$/)
  end

  it 'starts cleanup service' do
    shell_out('service cleanup status').stdout.must_match(/^cleanup start\/running, process [0-9]*$/)
  end

  it 'listens on port 3480' do
    assert shell_out('lsof -n -i :3480').exitstatus == 0
  end

end
