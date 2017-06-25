const Rx = require('rxjs');
const messaging = require('./messaging').messaging;
const database = require('./database');
const db = database.database;
const DB_PATHS = database.DB_PATHS({version: 1});

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
}).map(async gameSnapshot => {
    const game = gameSnapshot.val();
    const gameKey = gameSnapshot.key;
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
        key: gameKey
    });
});

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
    console.log(`Updating ${gameKey}.`);
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
function sendNotification(game) {
    console.log(`Change in game '${game.key}': sending notification to '${game.player.name}'`);
    const payload = {
        notification: hasGameEnded(game) ?
        {
            title: `${game.opponent.name} has just defeated you!`,
            body: `Sorry ${game.player.name}, you have lost the game in round #${game.moves.length}.`
        } :
        {
            title: `${game.opponent.name} has just moved!`,
            body: `It is round #${game.moves.length} in your game against ${game.opponent.name}.`
        }
    };
    const options = {
        priority: "high",
        timeToLive: 60 * 60 * 24
    };
    return messaging.sendToDevice(
        game.player.token,
        payload,
        options
    );
}

gameChangeStream.subscribe(promisedGame => {
    (async () => {
        const game = await promisedGame;

        await sendNotification(game);
        await updateLastGameAction(game.key);
    })().catch(e => {
        console.error('error occured, while processing actions:', e);
    });
}, e => {
    console.error('error occured while processing event:', e);
}, () => {
    console.log('connection closed.');
});
