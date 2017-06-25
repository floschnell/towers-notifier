const config = require('./config');
const admin = require('firebase-admin');

admin.initializeApp(config);

module.exports = {
    messaging: admin.messaging()
};
