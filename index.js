const firebase = require('firebase');
const Rx = require('rxjs');
const admin = require('firebase-admin');
const cert = require('./cert.json');

const config = {
    credential: admin.credential.cert(cert),
    databaseURL: "https://towers-42c7a.firebaseio.com",
    messagingSenderId: "80269606755",
};
firebase.initializeApp(config);
admin.initializeApp(config);
const db = app.database();
const messaging = admin.messaging();

const gameChangeStream = Rx.Observable.create(observer => {
    const ref = db.ref('v1/games');
    const eventRef = ref.on('child_changed', val => observer.next(val));

    return () => {
        ref.off('child_changed', eventRef);
    };
});

function getPlayer(playerId) {
    const playerRef = db.ref(`v1/players/${playerId}`);
    return playerRef.once('value');
}

function updateLastGameAction(game) {
    
}

function sendNotification(player, opponent, game) {
    const payload = {
        notification: {
            title: "Urgent action needed!",
            body: "Urgent action is needed to prevent your account from being disabled!"
        }
    };
    const options = {
        priority: "high",
        timeToLive: 60 * 60 * 24
    };
    messaging.sendToDevice(
        'd6F2YbBYaUU:APA91bGwD31J9YhIquihWoH7X4_PihjjSn668qykWxGqLuGDn8GgBXroG-9uHFrBeq0Iw3l3yfYKg18bmD6MTAxRzm-1BODqCRm_7RwzCPK0wF31aL71YwMbGO9sqr8GD_sC3cx0Fhd1',
        payload,
        options
    );
}

async function handleGameChange(game) {
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
    console.log(`Current player is now: ${player.name}, so I will send a notification to ${player.token}`);
    sendNotification(player, opponent, game)
}

gameChangeStream.subscribe(gameSnapshot => {
    handleGameChange(gameSnapshot.val());
}, err => {
    console.error('something went wrong!');
}, () => {
    console.log('connection closed.');
});