#
# Cookbook Name:: runnable_api-server
# Recipe:: deploy
#
# Copyright 2014, Runnable.com
#
# All rights reserved - Do Not Redistribute
#

deploy node['runnable_api-server']['deploy']['deploy_path'] do
  repo 'git@github.com:CodeNow/api-server.git'
  branch 'master'
  deploy_to node['runnable_api-server']['deploy']['deploy_path']
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
  cwd "#{node['runnable_api-server']['deploy']['deploy_path']}/current"
  action :run
end

template '/etc/init/api-server.conf' do
  variables({
    :node_env => node.chef_environment,
    :deploy_path => "#{node['runnable_api-server']['deploy']['deploy_path']}/current"
  })
  action :create
  notifies :restart, 'service[api-server]', :immediately
end

template '/etc/init/cleanup.conf' do
  variables({
    :node_env => node.chef_environment,
    :deploy_path => "#{node['runnable_api-server']['deploy']['deploy_path']}/current"
  })
  action :create
  notifies :restart, 'service[cleanup]', :immediately
end

service 'api-server' do
  action :enable
end

service 'cleanup' do
  action :enable
end
