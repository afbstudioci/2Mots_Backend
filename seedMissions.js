// seedMissions.js
const mongoose = require('mongoose');
const Mission = require('./src/models/Mission');
require('dotenv').config();

const missions = [
    {
        title: "Génie du Lexique",
        desc: "Résoudre 5 énigmes aujourd'hui",
        reward: 50,
        type: 'daily',
        targetType: 'words_solved',
        targetValue: 5
    },
    {
        title: "L'Ami Fidèle",
        desc: "Ajouter 1 nouvel ami",
        reward: 100,
        type: 'daily',
        targetType: 'friends_added',
        targetValue: 1
    },
    {
        title: "Collectionneur",
        desc: "Résoudre 10 énigmes au total",
        reward: 150,
        type: 'achievement',
        targetType: 'words_solved',
        targetValue: 10
    },
    {
        title: "Socialite",
        desc: "Avoir 5 amis acceptés",
        reward: 250,
        type: 'achievement',
        targetType: 'friends_added',
        targetValue: 5
    }
];

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connecté à MongoDB pour le seeding...");

        await Mission.deleteMany({}); // Nettoyer
        await Mission.insertMany(missions);

        console.log("Missions seedées avec succès !");
        process.exit(0);
    } catch (e) {
        console.error("Erreur de seeding:", e);
        process.exit(1);
    }
};

seed();
