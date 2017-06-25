const firebase = require('firebase');
const config = require('./config');

firebase.initializeApp(config);

module.exports = {
    DB_PATHS: ({version}) => ({
        NOTIFICATIONS: `v${version}/notifications`,
        PLAYERS: `v${version}/players`,
        GAMES: `v${version}/games`
    }),
    database: firebase.database()
};
