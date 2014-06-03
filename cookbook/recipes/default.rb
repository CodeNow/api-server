#
# Cookbook Name:: runnable_api-server
# Recipe:: default
#
# Copyright 2014, Runnable.com
#
# All rights reserved - Do Not Redistribute
#

include_recipe 'runnable_base'

include_recipe 'runnable_api-server::nodejs'
include_recipe 'runnable_api-server::deploy'

include_recipe 'runnable_api-server::newrelic' if node.chef_environment == 'prod'
