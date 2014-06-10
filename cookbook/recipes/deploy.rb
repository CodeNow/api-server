#
# Cookbook Name:: runnable_api-server
# Recipe:: deploy
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
  notifies :deploy, "deploy[#{node['runnable_api-server']['deploy']['deploy_path']}]", :delayed
  notifies :create, 'cookbook_file[/root/.ssh/runnable_api-server.pub]', :immediately
end

cookbook_file '/root/.ssh/runnable_api-server.pub' do
  source 'runnable_api-server.key.pub'
  owner 'root'
  group 'root'
  mode 0600
  action :create
  notifies :deploy, "deploy[#{node['runnable_api-server']['deploy']['deploy_path']}]", :delayed
end

cookbook_file '/tmp/git_sshwrapper.sh' do
  source 'git_sshwrapper.sh'
  owner 'root'
  group 'root'
  mode 0755
  action :create
end

deploy node['runnable_api-server']['deploy']['deploy_path'] do
  repo 'git@github.com:CodeNow/api-server.git'
  git_ssh_wrapper '/tmp/git_sshwrapper.sh'
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
  action :nothing
  notifies :restart, 'service[api-server]', :delayed
  notifies :restart, 'service[cleanup]', :delayed
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
  provider Chef::Provider::Service::Upstart
  supports :status => true, :restart => true, :reload => false
  action :enable
end

service 'cleanup' do
  provider Chef::Provider::Service::Upstart
  supports :status => true, :restart => true, :reload => false
  action :enable
end
