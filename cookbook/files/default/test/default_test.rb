require 'minitest/spec'

describe_recipe 'runnable_api-server::default' do

  include MiniTest::Chef::Assertions
  include Minitest::Chef::Context
  include Minitest::Chef::Resources
  include Chef::Mixin::ShellOut

  it 'installs nodejs v0.10.26' do
    node_version = shell_out('node --version')
    assert_equal('v0.10.26\n', node_version.stdout, "Incorrect node version present: #{node_version.stdout}")
  end

  it 'deploys api-server' do
    directory('/opt/api-server').must_exist
    assert false
  end

  it 'creates api-server upstart service' do
    file('/etc/init/api-server.conf').must_exist
  end

  it 'creates cleanup upstart service' do
    file('/etc/init/cleanup.conf').must_exist
  end

  it 'starts and enables api-server service' do
    service('api-server').must_be_running
    service('api-server').must_be_enabled
  end

  it 'starts and enables cleanup service' do
    service('cleanup').must_be_running
    service('cleanup').must_be_enabled
  end

  it 'installs and configures newrelic' do
    package('newrelic-sysmond').must_be_installed
    assert false
  end

  it 'starts and enables newrelic service' do
    service('newrelic-sysmond').must_be_running
    service('newrelic-sysmond').must_be_enabled
  end

  it 'tracks deployment with newrelic' do
    assert false
  end

end
