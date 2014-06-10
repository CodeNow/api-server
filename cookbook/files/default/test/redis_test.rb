require 'minitest/spec'

describe_recipe 'runnable_api-server::redis' do

  include MiniTest::Chef::Assertions
  include Minitest::Chef::Context
  include Minitest::Chef::Resources
  include Chef::Mixin::ShellOut

  it 'installs redis-server' do
    package('redis-server').must_be_installed
  end

  it 'configures redis' do
    file('/etc/redis/redis.conf').must_exist
  end

  it 'starts and enables redis-server' do
    service('redis-server').must_be_running
    service('redis-server').must_be_enabled
  end

end
