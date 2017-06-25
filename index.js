const Rx = require('rxjs');
const messaging = require('./messaging').messaging;
const database = require('./database');
const db = database.database;
const DB_PATHS = database.DB_PATHS({version: 1});

/**
 * Enriches a game object with information on player and opponent.
 * 
 * @param {FirebaseDataSnapshot} gameSnapshot Snapshot of a game that should be enriched.
 * @return {Object}
 */
async function enrichGame(gameSnapshot) {
    const game = gameSnapshot.val();
    const playerId = game.currentPlayer;
    const opponentId = Object
        .keys(game.players)
        .find(player => player !== playerId);
    const promisedPlayer = getPlayer(playerId);
    const promisedOpponent = getPlayer(opponentId);
    const playerSnapshots = await Promise
        .all([promisedPlayer, promisedOpponent]);
    const [player, opponent] = playerSnapshots
        .map(playerSnapshot => playerSnapshot.val());

    return Object.assign(game, {
        player,
        opponent,
        key: gameSnapshot.key
    });
}

/**
 * Transform the callbacks into a notification stream and enrich
 * each game notification with the objects of the participating players.
 */
const gameChangeStream = Rx.Observable.create(observer => {
    const gamesRef = db.ref(DB_PATHS.GAMES);
    const callbackRef = gamesRef.on('child_changed', val => observer.next(val));

    return () => {
        gamesRef.off('child_changed', callbackRef);
    };
}).map(enrichGame);

/**
 * Gets the list of last sent notifications every hour.
 * Checks which notifications have been sent since a certain threshold and
 * resends notifications to get the players going again.
 */
const intervalStreamOfAbandonedGames = Rx.Observable
    .interval(60 * 60 * 1000)
    .timeInterval()
    .map(invocationNumber => {
        const notificationsRef = db.ref(DB_PATHS.NOTIFICATIONS);

        return notificationsRef
            .once('value')
            .then(snapshot => snapshot.val());
    })
    .map(async promisedNotifications => {
        const notifications = await promisedNotifications;
        const notificationGameKeys = Object.keys(notifications);

        const promisedGameSnapshots = notificationGameKeys
            .map(getGame)
        const gameSnapshots = await Promise.all(promisedGameSnapshots);
        const gameExists = gameSnapshots.map(snapshot => snapshot.exists());

        const currentTime = Date.now();
        const olderThan3Hours = lastUpdate => Date.now() - lastUpdate > 3 * 60 * 60 * 1000;

        return Promise.all(notificationGameKeys
            .filter((value, index) => gameExists[index])
            .filter(gameKey => olderThan3Hours(notifications[gameKey]))
            .map(gameKey => getGame(gameKey))
            .map(async game => enrichGame(await game)));
    });

/**
 * Gets a game from the database.
 * 
 * @param {String} gameKey Key to identify the game.
 * @return {Promise<FirebaseDataSnapshot>}
 */
function getGame(gameKey) {
    const gamesRef = db.ref(`${DB_PATHS.GAMES}/${gameKey}`);

    return gamesRef.once('value');
}

/**
 * Retrieves a player object from the database by its ID.
 * 
 * @param {String} playerId ID of the player to get from the database.
 * @return {Promise<FirebaseDataSnapshot>}
 */
function getPlayer(playerId) {
    const playerRef = db.ref(`${DB_PATHS.PLAYERS}/${playerId}`);

    return playerRef.once('value');
}

/**
 * Updates the timestamp, when this game has last caused a notification.
 * 
 * @param {String} gameKey Key that identifies this game.
 * @return {Promise<void>}
 */
function updateLastGameAction(gameKey) {
    const gameLastUpdateRef = db.ref(`${DB_PATHS.NOTIFICATIONS}/${gameKey}`);

    return gameLastUpdateRef.set(Date.now());
}

/**
 * Checks a game for its current state and returns true if it has ended.
 * 
 * @param {Object} game Game to check whether it has ended.
 * @return {Boolean}
 */
function hasGameEnded(game) {
    if (game.moves) {
        const lastMove = game.moves[game.moves.length - 1];
        
        return lastMove.targetField.y === 0 ||
            lastMove.targetField.y === 7;
    }

    return false;
}

/**
 * Sends a notification to the player that has been waiting for his opponent.
 * 
 * @param {Object} game Game this notification is about.
 * @returns {Promise<Object>}
 */
function sendNotification(title, body, token) {
    const payload = {
        notification: {
            title,
            body,
            sound: 'default'
        }
    };
    const options = {
        priority: "high",
        timeToLive: 60 * 60 * 24
    };

    return messaging.sendToDevice(
        token,
        payload,
        options
    );
}

gameChangeStream.subscribe(promisedGame => {
    (async () => {
        const game = await promisedGame;

        console.log(`Change in game '${game.key}': sending notification to '${game.player.name}'`);
        if (hasGameEnded(game)) {
            await sendNotification(
                `${game.opponent.name} has just defeated you!`,
                `Sorry ${game.player.name}, you have lost the game in round #${game.moves.length}.`,
                game.player.token
            );
        } else {
            await sendNotification(
                `${game.opponent.name} has just moved!`,
                `It is round #${game.moves.length} in your game against ${game.opponent.name}.`,
                game.player.token
            );
        }
        await updateLastGameAction(game.key);
    })().catch(e => {
        console.error('error occured, while processing actions:', e);
    });
}, e => {
    console.error('error occured while processing event:', e);
}, () => {
    console.warn('game stream: closed.');
});

intervalStreamOfAbandonedGames.subscribe(async promisedAbandonedGames => {
    const abandonedGames = await promisedAbandonedGames;

    abandonedGames
        .forEach(async abandonedGame => {
            console.log(`The game ${abandonedGame.key} has not shown any activity for some time, will resend notification.`);
            await sendNotification(
                `${abandonedGame.opponent.name} is still waiting.`,
                `Hey ${abandonedGame.player.name}, ${abandonedGame.opponent.name} is still waiting for you to move.`,
                abandonedGame.player.token
            );
            await updateLastGameAction(abandonedGame.key);
        });
}, e => {
    console.error('error occured while processing event:', e);
}, () => {
    console.warn('notification stream: closed.');
});