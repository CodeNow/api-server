#
# Cookbook Name:: runnable_api-server
# Recipe:: deploy
#
# Copyright 2014, Runnable.com
#
# All rights reserved - Do Not Redistribute
#

package 'git'

deploy node['runnable_api-server']['deploy_path'] do
  repo 'git@github.com:CodeNow/api-server.git'
  git_ssh_wrapper '/tmp/git_sshwrapper.sh'
  branch node['runnable_api-server']['deploy_branch']
  deploy_to node['runnable_api-server']['deploy_path']
  migrate false
  create_dirs_before_symlink []
  purge_before_symlink []
  symlink_before_migrate({})
  symlinks({})
  action :deploy
  notifies :run, 'execute[npm install]', :immediately
  notifies :create, 'template[/etc/init/api-server.conf]', :immediately
  notifies :create, 'template[/etc/init/cleanup.conf]', :immediately
end

execute 'npm install' do
  cwd "#{node['runnable_api-server']['deploy_path']}/current"
  action :nothing
  notifies :restart, 'service[api-server]', :delayed
  notifies :restart, 'service[cleanup]', :delayed
  notifies :create, 'template[/etc/init/api-server.conf]', :immediately
  notifies :create, 'template[/etc/init/cleanup.conf]', :immediately
end

template '/etc/init/api-server.conf' do
  variables({
    :node_env => node.chef_environment,
    :deploy_path => "#{node['runnable_api-server']['deploy_path']}/current"
  })
  action :create
  notifies :restart, 'service[api-server]', :immediately
end

template '/etc/init/cleanup.conf' do
  variables({
    :node_env => node.chef_environment,
    :deploy_path => "#{node['runnable_api-server']['deploy_path']}/current"
  })
  action :create
  notifies :restart, 'service[cleanup]', :immediately
end

service 'api-server' do
  provider Chef::Provider::Service::Upstart
  supports :status => true, :restart => true, :reload => false
  action :nothing
end

service 'cleanup' do
  provider Chef::Provider::Service::Upstart
  supports :status => true, :restart => true, :reload => false
  action :nothing
end
