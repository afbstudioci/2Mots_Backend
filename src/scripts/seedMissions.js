//src/scripts/seedMissions.js
const mongoose = require('mongoose');
const Mission = require('../models/Mission');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const missions = [
    {
        title: "Éclaireur de Logique",
        desc: "Résolvez 5 paires de mots aujourd'hui.",
        reward: 15,
        type: 'daily',
        targetType: 'words_solved',
        targetValue: 5
    },
    {
        title: "Maître des Liens",
        desc: "Atteignez le niveau 5.",
        reward: 50,
        type: 'achievement',
        targetType: 'levels_reached',
        targetValue: 5
    },
    {
        title: "Socialite",
        desc: "Ajoutez votre premier ami.",
        reward: 20,
        type: 'achievement',
        targetType: 'friends_added',
        targetValue: 1
    }
];

const seedMissions = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connecté à MongoDB pour le seeding...");
        
        await Mission.deleteMany({});
        await Mission.insertMany(missions);
        
        console.log("Missions créées avec succès !");
        process.exit();
    } catch (error) {
        console.error("Erreur de seeding:", error);
        process.exit(1);
    }
};

seedMissions();
