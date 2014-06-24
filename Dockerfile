#
# api_main Dockerfile
#
#
# Pull base image.
FROM 54.176.97.94:5000/api_base
# Download API-Server Repo
RUN eval $(ssh-agent) > /dev/null && ssh-add /.ssh/id_rsa && git clone git@github.com:CodeNow/api-server.git 

WORKDIR api-server 
RUN npm install 
RUN npm build 

# Expose port to Host
EXPOSE 3000
# Define default command.
CMD ["NODE_ENV=staging pm2 start server.js -n API-Server", "pm2 logs"]
