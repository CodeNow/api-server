require 'minitest/spec'

describe_recipe 'runnable_api-server::mongodb' do

  include MiniTest::Chef::Assertions
  include Minitest::Chef::Context
  include Minitest::Chef::Resources
  include Chef::Mixin::ShellOut

  it 'installs mongodb' do
    package('mongodb-10gen').must_be_installed
  end

  it 'configures mongodb' do
    file('/etc/mongodb.conf').must_exist
  end

  it 'starts and enables mongodb' do
    service('mongodb').must_be_running
    service('mongodb').must_be_enabled
  end

end
