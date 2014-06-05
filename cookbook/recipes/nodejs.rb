#
# Cookbook Name:: runnable_api-server
# Recipe:: nodejs
#
# Copyright 2014, Runnable.com
#
# All rights reserved - Do Not Redistribute
#

node.set['nodejs']['version'] = '0.10.28'
node.set['nodejs']['checksum'] = 'abddc6441e0f208f6ed8a045e0293f713ea7f6dfb2d6a9a2024bf8b1b4617710'
node.set['nodejs']['checksum_linux_x64'] = '5f41f4a90861bddaea92addc5dfba5357de40962031c2281b1683277a0f75932'
node.set['nodejs']['checksum_linux_x86'] = '81ee7f30c35e1743790fd9ca47235bdec4a6c9d2b89a70f33c69e80008cbf422'
include_recipe 'nodejs'

