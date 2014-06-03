require 'minitest/spec'

describe_recipe 'runnable_api-server::default' do

  include MiniTest::Chef::Assertions
  include Minitest::Chef::Context
  include Minitest::Chef::Resources
  include Chef::Mixin::ShellOut

  it 'installs nodejs v0.10.26' do
    node_version = Mixlib::ShellOut.new('node --version').run_command
    node_version.run_command
    assert_equal('v0.10.26\n', node_version.stdout, "Incorrect node version present: #{node_version.stdout}")
  end

  it 'deploys api-server' do
    directory('/home/ubuntu/api-server').must_exist
  end

  it 'creates api-server upstart service' do
    file('/etc/init/api-server.conf').must_exist
  end

  it 'creates cleanup upstart service' do
    file('/etc/init/cleanup.conf').must_exist
  end

end
