//src/config/db.js
const mongoose = require('mongoose');
const { mongoUri } = require('./env');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(mongoUri);
        console.log(`MongoDB Connecte: ${conn.connection.host}`);
        
        // Nettoyage automatique des anciens index (corrige le bug E11000 du champ 'username')
        const User = require('../models/User');
        await User.syncIndexes();
        
    } catch (error) {
        console.error(`Erreur de connexion MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;