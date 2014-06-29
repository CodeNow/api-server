#
# Cookbook Name:: runnable_api-server
# Recipe:: deploy_ssh
#
# Copyright 2014, Runnable.com
#
# All rights reserved - Do Not Redistribute
#

directory '/root/.ssh' do
  owner 'root'
  group 'root'
  mode 0700
  action :create
  notifies :create, 'cookbook_file[/root/.ssh/runnable_api-server]', :immediately
end

cookbook_file '/root/.ssh/runnable_api-server' do
  source 'runnable_api-server.key'
  owner 'root'
  group 'root'
  mode 0600
  action :create
  notifies :deploy, "deploy[#{node['runnable_api-server']['deploy_path']}]", :delayed
  notifies :create, 'cookbook_file[/root/.ssh/runnable_api-server.pub]', :immediately
end

cookbook_file '/root/.ssh/runnable_api-server.pub' do
  source 'runnable_api-server.key.pub'
  owner 'root'
  group 'root'
  mode 0600
  action :create
  notifies :deploy, "deploy[#{node['runnable_api-server']['deploy_path']}]", :delayed
end

cookbook_file '/tmp/git_sshwrapper.sh' do
  source 'git_sshwrapper.sh'
  owner 'root'
  group 'root'
  mode 0755
  action :create
end