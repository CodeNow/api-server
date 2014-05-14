#
# Node.js Dockerfile
#
#
# Pull base image.
FROM sandipsingh/node-v0.10.26
# Installing the dependency & Packages
RUN apt-get update
# ssh key
RUN eval `ssh-agent`
RUN ssh-add ~/.ssh/id_rsa 
# Installing API-Server
RUN git clone git@github.com:CodeNow/api-server.git 
WORKDIR api-server RUN npm install 
WORKDIR api-server RUN make 
WORKDIR api-server RUN npm build 
# Expose port to Host
EXPOSE 3000 
# Start/stop/restart API-Server
#CMD ["WORKDIR api-server RUN NODE_ENV=staging pm2 start server.js -n API-Server"]
