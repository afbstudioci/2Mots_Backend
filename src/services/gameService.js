const WordPair = require('../models/WordPair');
const User = require('../models/User');

const normalizeText = (text) => {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

const checkAnswerRealtime = async (userId, wordPairId, userAnswer, timeSpent) => {
    const pair = await WordPair.findById(wordPairId);
    if (!pair) {
        throw new Error('Enigme introuvable');
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new Error('Utilisateur introuvable');
    }

    // Ajout aux mots joués si ce n'est pas déjà fait
    if (!user.playedWords.includes(pair._id)) {
        user.playedWords.push(pair._id);
    }

    const normalizedAnswer = normalizeText(userAnswer);
    let isCorrect = false;
    let points = 0;
    let accuracy = 0;

    const checkArray = (arr) => arr.map(normalizeText).includes(normalizedAnswer);

    // Vérification de la réponse
    if (checkArray(pair.exactMatch)) {
        isCorrect = true; points = 10; accuracy = 100;
    } else if (checkArray(pair.closeMatch)) {
        isCorrect = true; points = 8; accuracy = 80;
    } else if (checkArray(pair.partialMatch)) {
        isCorrect = true; points = 5; accuracy = 50;
    }

    let timeWon = 0;
    let earnedKevs = 0;
    let leveledUp = false;
    let currentXp = user.xp;
    let newLevel = user.level;

    if (isCorrect) {
        // 1 Kev par bonne réponse (Economie stricte)
        earnedKevs = 1;
        user.kevs += earnedKevs;

        // Système de Vague (XP)
        user.xp += 1;
        currentXp = user.xp;
        
        const enigmasNeededForLevel = 3 + (user.level * 2);
        
        if (user.xp >= enigmasNeededForLevel) {
            user.level += 1;
            user.xp -= enigmasNeededForLevel;
            currentXp = user.xp;
            newLevel = user.level;
            leveledUp = true;
            earnedKevs += 5; // Bonus de niveau
            user.kevs += 5;
        }

        // Calcul du temps gagné en fonction de la rapidité
        if (timeSpent <= 5) {
            timeWon = 12; // Réponse éclair
            points = Math.floor(points * 1.5);
        } else if (timeSpent <= 15) {
            timeWon = 8;  // Réponse rapide
        } else {
            timeWon = 4;  // Réponse lente
        }
    }

    await user.save();

    return {
        isCorrect,
        points,
        accuracy,
        timeWon,
        earnedKevs,
        leveledUp,
        newLevel,
        currentXp,
        xpNeeded: 3 + (newLevel * 2),
        expectedAnswer: isCorrect ? pair.exactMatch[0] : null,
        logicalHint: pair.clue // Renvoyé si incorrect pour le bouton indice
    };
};

const validateFinalSession = async (userId, answers) => {
    const user = await User.findById(userId);
    if (!user) throw new Error('Utilisateur introuvable');

    if (!answers || !Array.isArray(answers)) {
        throw new Error('Format invalide');
    }

    let totalTime = 0;
    let totalScore = 0;
    const corrections = [];

    for (const item of answers) {
        totalTime += item.timeSpent || 0;
    }

    // Anti-triche
    if (answers.length >= 5 && totalTime < 2) {
        user.isBanned = true;
        user.banReason = "Speedhack détecté (Temps impossible)";
        await user.save();
        throw new Error('Tricherie détectée. Compte banni.');
    }

    for (const item of answers) {
        if (!item.wordPairId) continue;
        const pair = await WordPair.findById(item.wordPairId);
        if (!pair) continue;

        const userAnswer = normalizeText(item.answer);
        let points = 0;
        let isCorrect = false;

        const checkArray = (arr) => arr.map(normalizeText).includes(userAnswer);

        if (checkArray(pair.exactMatch)) { points = 10; isCorrect = true; }
        else if (checkArray(pair.closeMatch)) { points = 8; isCorrect = true; }
        else if (checkArray(pair.partialMatch)) { points = 5; isCorrect = true; }

        if (isCorrect && item.timeSpent <= 5) { points = Math.floor(points * 1.5); }

        if (!isCorrect) {
            corrections.push({
                word1: pair.word1,
                word2: pair.word2,
                expectedAnswer: pair.exactMatch[0],
                userAnswer: item.answer || "Non répondu"
            });
        }

        totalScore += points;
    }

    if (totalScore > user.bestScore) {
        user.bestScore = totalScore;
    }

    await user.save();

    return {
        totalScore,
        corrections
    };
};

module.exports = {
    checkAnswerRealtime,
    validateFinalSession
};