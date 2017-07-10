const admin = require('firebase-admin');
const cert = require('./cert.json');

admin.initializeApp({
    credential: admin.credential.cert(cert),
    databaseURL: "https://towers-42c7a.firebaseio.com",
    messagingSenderId: "80269606755",
});

module.exports = admin;