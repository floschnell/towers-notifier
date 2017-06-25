FROM node:8.1.2

# copy code
COPY . /var/towers-notifier

# install dependencies
WORKDIR /var/towers-notifier
RUN npm install --silent

# run the notifier tool
CMD npm start