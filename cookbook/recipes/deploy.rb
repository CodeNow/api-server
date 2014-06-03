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
  notifies :run, execute['npm install'] 
end

execute 'npm install' do
  cwd node['runnable_api-server']['deploy_to']
  action :run
end
