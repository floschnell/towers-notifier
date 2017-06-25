# towers-notifier
Additional component to the Towers game. It watches the database for changes and notifies players of game changes.

## Setup
For the tool to function correctly, you will need to install its dependencies by running **npm install** from within the root folder of the application.

Furthermore you have to provide it with your Firebase certificate. You can retrieve this from the options section of your Firebase Console. Just place the json file in the root folder and rename it to *cert.json*.

## Launch
To start the tool, simply call **npm start**.

## Deploy
The tool can be easily deployed using a docker container. I have created a very simple one for myself that I build and run with **npm run deploy**. It is currently configured so that it uses my server and docker repository. Feel free to modify the *package.json* so that it suits your environment.