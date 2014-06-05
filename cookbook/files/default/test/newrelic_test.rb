require 'minitest/spec'

describe_recipe 'runnable_api-server::default' do

  include MiniTest::Chef::Assertions
  include Minitest::Chef::Context
  include Minitest::Chef::Resources
  include Chef::Mixin::ShellOut

  it 'installs and configures newrelic' do
    package('newrelic-sysmond').must_be_installed
  end

  it 'configures newrelic' do
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
