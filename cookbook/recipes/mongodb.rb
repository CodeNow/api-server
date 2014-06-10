#
# Cookbook Name:: runnable_api-server
# Recipe:: mongodb
#
# Copyright 2014, Runnable.com
#
# All rights reserved - Do Not Redistribute
#

apt_repository 'mongodb' do
  uri "http://downloads-distro.mongodb.org/repo/ubuntu-upstart"
  distribution 'dist'
  components ['10gen']
  keyserver 'hkp://keyserver.ubuntu.com:80'
  key '7F0CEB10'
  action :add
  notifies :install, 'package[mongodb-10gen]'
end

package 'mongodb-10gen' do
  action :install
  notifies :create, 'template[/etc/mongodb.conf]', :immediately
end

template '/etc/mongodb.conf' do
  source 'mongodb.conf.erb'
  variables({
    :dbpath => '/var/lib/mongodb',
    :logpath => '/var/log/mongodb/mongodb.log',
    :replSet => 'rs0'
  })
  action :create
  notifies :restart, 'service[mongodb]', :immediately
end

service 'mongodb' do
  action :enable
end
