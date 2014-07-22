#
# Cookbook Name:: runnable_api-server
# Recipe:: deploy
#
# Copyright 2014, Runnable.com
#
# All rights reserved - Do Not Redistribute
#

deploy node['runnable_api-server']['deploy_path'] do
  repo 'git@github.com:CodeNow/api-server.git'
  git_ssh_wrapper '/tmp/git_sshwrapper.sh'
  branch node['runnable_api-server']['deploy_branch']
  deploy_to node['runnable_api-server']['deploy_path']
  migrate false
  before_migrate do
    file 'config' do
      path "#{release_path}/configs/#{node.chef_environment}.json"
      content JSON.pretty_generate node['runnable_api-server']['config']
      action :create
      notifies :run, 'execute[npm install]', :immediately
    end

    execute 'npm install' do
      cwd release_path
      environment({'NODE_ENV' => node.chef_environment})
      action :nothing
    end

  end
  before_restart do
    template '/etc/init/api-server.conf' do
      variables({
        :node_env => node.chef_environment,
        :deploy_path => release_path
      })
      action :create
    end
    
    template '/etc/init/cleanup.conf' do
      variables({
        :node_env => node.chef_environment,
        :deploy_path => release_path
      })
      action :create
    end
  end
  restart_command do
    %w{api-server cleanup}.each do |s|
      service s do
        provider Chef::Provider::Service::Upstart
        supports :status => true, :restart => true, :reload => false
        action [:start, :enable]
      end
    end
  end
  create_dirs_before_symlink []
  purge_before_symlink []
  symlink_before_migrate({})
  symlinks({})
  action :deploy
end
