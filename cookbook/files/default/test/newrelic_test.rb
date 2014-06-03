require 'minitest/spec'

describe_recipe 'runnable_base::access' do

  include MiniTest::Chef::Assertions
  include Minitest::Chef::Context
  include Minitest::Chef::Resources
  include Chef::Mixin::ShellOut

  it 'installs and configures api-server' do
    assert false
  end

end
