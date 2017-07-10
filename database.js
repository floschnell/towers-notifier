const admin = require('./admin');

module.exports = {
    DB_PATHS: ({ version }) => ({
        NOTIFICATIONS: `v${version}/notifications`,
        PLAYERS: `v${version}/players`,
        GAMES: `v${version}/games`
    }),
    database: admin.database()
};
