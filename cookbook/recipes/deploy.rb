#
# Cookbook Name:: runnable_api-server
# Recipe:: deploy
#
# Copyright 2014, Runnable.com
#
# All rights reserved - Do Not Redistribute
#

deploy 'api-server' do
  repo 'https://github.com/CodeNow/api-server.git'
  branch node['runnable_api-server']['deploy_branch']
  deploy_to node['runnable_api-server']['deploy_to']
  action :deploy
  notifies :run, 'execute[npm install]', :immediately
  notifies :create, 'file[api-server]', :immediately
  notifies :create, 'file[cleanup]', :immediately
end

execute 'npm install' do
  cwd node['runnable_api-server']['deploy_to']
  action :run
end

template '/etc/init/api-server.conf' do
  variables({:node_env => node.chef_environment})
  action :create
  notifies :restart, 'service[api-server]', :immediately
end

template '/etc/init/cleanup.conf' do
  variables({:node_env => node.chef_environment})
  action :create
  notifies :restart, 'service[cleanup]', :immediately
end

service 'api-server' do
  action :enable
end

service 'cleanup' do
  action :enable
end
