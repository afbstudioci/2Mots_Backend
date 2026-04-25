const WordPair = require('../models/WordPair');
const User = require('../models/User');

const normalizeText = (text) => {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

exports.getBatch = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.isBanned) {
            return res.status(403).json({ status: 'error', message: 'Compte suspendu.' });
        }

        let words = await WordPair.aggregate([
            { $match: { _id: { $nin: user.playedWords }, isActive: true } },
            { $sample: { size: 10 } },
            // On s'assure de renvoyer le clue (indice) et expectedType pour le frontend
            { $project: { word1: 1, word2: 1, clue: 1, expectedType: 1 } } 
        ]);

        // Fallback si le joueur a tout joué
        if (words.length < 10) {
            const keepCount = Math.floor(user.playedWords.length * 0.2);
            user.playedWords = user.playedWords.slice(-keepCount);
            await user.save();

            words = await WordPair.aggregate([
                { $match: { _id: { $nin: user.playedWords }, isActive: true } },
                { $sample: { size: 10 } },
                { $project: { word1: 1, word2: 1, clue: 1, expectedType: 1 } }
            ]);
        }

        // Fallback ultime si la base est encore trop vide
        if (words.length < 10) {
            words = await WordPair.aggregate([
                { $match: { isActive: true } },
                { $sample: { size: 10 } },
                { $project: { word1: 1, word2: 1, clue: 1, expectedType: 1 } }
            ]);
        }

        res.status(200).json({ status: 'success', data: words });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.validateSession = async (req, res) => {
    try {
        const { answers } = req.body; 
        const user = await User.findById(req.user.id);

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ status: 'error', message: 'Format invalide' });
        }

        let totalTime = 0;
        let totalScore = 0;
        let earnedKevs = 0;
        const corrections = [];
        const newPlayedWords = [];
        let correctAnswersCount = 0; // Pour le système de Vague (XP)

        for (const item of answers) {
            totalTime += item.timeSpent || 0;
        }

        // Anti-triche
        if (answers.length >= 5 && totalTime < 2) {
            user.isBanned = true;
            user.banReason = "Speedhack détecté (Temps impossible)";
            await user.save();
            return res.status(403).json({ status: 'error', message: 'Tricherie détectée. Compte banni.' });
        }

        for (const item of answers) {
            const pair = await WordPair.findById(item.wordPairId);
            if (!pair) continue;

            newPlayedWords.push(pair._id);
            const userAnswer = normalizeText(item.answer);
            let points = 0;
            let isCorrect = false;

            const checkArray = (arr) => arr.map(normalizeText).includes(userAnswer);

            // Calcul des points (pour le score de la session, pas pour les Kevs)
            if (checkArray(pair.exactMatch)) {
                points = 10;
                isCorrect = true;
            } else if (checkArray(pair.closeMatch)) {
                points = 8;
                isCorrect = true;
            } else if (checkArray(pair.partialMatch)) {
                points = 5;
                isCorrect = true;
            }

            // Bonus de temps
            if (isCorrect && item.timeSpent <= 5) {
                points = Math.floor(points * 1.5); 
            }

            if (isCorrect) {
                correctAnswersCount += 1;
            } else {
                corrections.push({
                    word1: pair.word1,
                    word2: pair.word2,
                    expectedAnswer: pair.exactMatch[0],
                    userAnswer: item.answer || "Non répondu"
                });
            }

            totalScore += points;
        }

        // --- NOUVELLE ECONOMIE & SYSTEME DE VAGUE ---
        
        // 1 Kev par bonne réponse, strict
        earnedKevs += correctAnswersCount; 
        
        // L'XP représente les énigmes réussies dans le niveau actuel
        user.xp += correctAnswersCount;
        
        // Formule du système de Vague : 3 + (niveau * 2)
        const enigmasNeededForLevel = 3 + (user.level * 2);
        
        let leveledUp = false;
        if (user.xp >= enigmasNeededForLevel) {
            user.level += 1;
            user.xp -= enigmasNeededForLevel; // On garde le surplus d'XP
            leveledUp = true;
            earnedKevs += 5; // Bonus de niveau en Kevs
        }

        user.kevs += earnedKevs;
        user.playedWords.push(...newPlayedWords);

        if (totalScore > user.bestScore) {
            user.bestScore = totalScore;
        }

        await user.save();

        res.status(200).json({
            status: 'success',
            data: {
                totalScore,
                earnedKevs,
                correctAnswersCount,
                leveledUp,
                newLevel: user.level,
                currentXp: user.xp,
                xpNeeded: enigmasNeededForLevel,
                isNewBest: totalScore === user.bestScore,
                corrections
            }
        });

    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};