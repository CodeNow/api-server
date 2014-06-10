#!/usr/bin/env bash
/usr/bin/env ssh -o "StrictHostKeyChecking=no" -i "/root/.ssh/runnable_api-server" $1 $2
