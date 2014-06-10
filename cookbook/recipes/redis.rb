#
# Cookbook Name:: runnable_api-server
# Recipe:: redis
#
# Copyright 2014, Runnable.com
#
# All rights reserved - Do Not Redistribute
#

package 'redis-server' do
  notifies :create, 'template[/etc/redis/redis.conf]', :immediately
  notifies :enable, 'service[redis-server]', :delayed
  action :install
end

template '/etc/redis/redis.conf' do
  source 'redis.conf.erb'
  variables({
    :bind => node['ipaddress'] || '127.0.0.1'
  })
  notifies :enable, 'service[redis-server]', :immediately
  action :create
end

service 'redis-server' do
  action :enable
end

