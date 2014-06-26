#
# Cookbook Name:: runnable_api-server
# Recipe:: nodejs
#
# Copyright 2014, Runnable.com
#
# All rights reserved - Do Not Redistribute
#

node.set['runnable_nodejs']['version'] = '0.10.28'
include_recipe 'runnable_nodejs'
