//src/config/db.js
const mongoose = require('mongoose');
const { mongoUri } = require('./env');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(mongoUri);
        console.log(`[BASE DE DONNÉES] MongoDB Connecté : ${conn.connection.host}`);
        
        // Nettoyage automatique des anciens index
        const User = require('../models/User');
        await User.syncIndexes();
        
    } catch (error) {
        console.error(`[BASE DE DONNÉES] Erreur de connexion : ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;