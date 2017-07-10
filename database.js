const admin = require('./admin');

module.exports = {
    DB_PATHS: ({ version }) => ({
        NOTIFICATIONS: `v${version}/notifications`,
        PLAYERS: `v${version}/players`,
        GAMES: `v${version}/games`,
        REQUESTS: `v${version}/requests`
    }),
    database: admin.database()
};
