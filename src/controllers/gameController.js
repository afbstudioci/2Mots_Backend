//src/controllers/gameController.js
const WordPair = require('../models/WordPair');
const User = require('../models/User');

const normalizeText = (text) => {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

exports.getWords = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.isBanned) {
            return res.status(403).json({ status: 'error', message: 'Compte suspendu.' });
        }

        let words = await WordPair.aggregate([
            { $match: { _id: { $nin: user.playedWords }, isActive: true } },
            { $sample: { size: 10 } },
            { $project: { word1: 1, word2: 1, clue: 1, expectedType: 1 } } 
        ]);

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

        res.status(200).json({ status: 'success', data: { words } });
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
        let earnedXP = 0;
        const corrections = [];
        const newPlayedWords = [];

        for (const item of answers) {
            totalTime += item.timeSpent || 0;
        }

        if (answers.length >= 5 && totalTime < 2) {
            user.isBanned = true;
            user.banReason = "Speedhack detecte (Temps impossible)";
            await user.save();
            return res.status(403).json({ status: 'error', message: 'Tricherie detectee. Compte banni.' });
        }

        for (const item of answers) {
            const pair = await WordPair.findById(item.wordPairId);
            if (!pair) continue;

            newPlayedWords.push(pair._id);
            const userAnswer = normalizeText(item.answer);
            let points = 0;
            let isCorrect = false;

            const checkArray = (arr) => arr.map(normalizeText).includes(userAnswer);

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

            if (isCorrect && item.timeSpent <= 5) {
                points = Math.floor(points * 1.5); 
            }

            if (!isCorrect) {
                corrections.push({
                    word1: pair.word1,
                    word2: pair.word2,
                    expectedAnswer: pair.exactMatch[0],
                    userAnswer: item.answer || "Non repondu"
                });
            }

            totalScore += points;
            earnedKevs += points; 
            earnedXP += points * 2; 
        }

        user.playedWords.push(...newPlayedWords);
        user.kevs += earnedKevs;
        if (!user.xp) user.xp = 0;
        user.xp += earnedXP;

        let leveledUp = false;
        const xpNeeded = user.level * 100;
        if (user.xp >= xpNeeded) {
            user.level += 1;
            user.xp -= xpNeeded;
            leveledUp = true;
            user.kevs += 50; 
        }

        if (totalScore > user.bestScore) {
            user.bestScore = totalScore;
        }

        await user.save();

        res.status(200).json({
            status: 'success',
            data: {
                totalScore,
                earnedKevs,
                earnedXP,
                leveledUp,
                newLevel: user.level,
                isNewBest: totalScore === user.bestScore,
                corrections
            }
        });

    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};