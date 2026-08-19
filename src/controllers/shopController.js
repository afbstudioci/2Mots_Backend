//src/controllers/shopController.js
const User = require('../models/User');

const CATALOG = {
    vip: {
        id: 'vip_monthly',
        title: 'Pass VIP 2Mots',
        priceEur: '2,99 €',
        period: 'par mois',
        perks: [
            'Zéro publicité dans tout le jeu',
            '15 Kevs offerts chaque jour',
            'Badge doré et Couronne de prestige',
            'Accès illimité au mode Entraînement'
        ]
    },
    kevsPacks: [
        { id: 'kevs_150', title: 'Poignée de Kevs', amount: 150, bonus: 0, priceEur: '0,99 €', icon: 'diamond-outline' },
        { id: 'kevs_700', title: 'Bourse de Réflexion', amount: 600, bonus: 100, priceEur: '2,99 €', tag: 'POPULAIRE', icon: 'diamond' },
        { id: 'kevs_3000', title: 'Coffre du Maître', amount: 2500, bonus: 500, priceEur: '9,99 €', tag: 'MEILLEURE VALEUR', icon: 'trophy' }
    ],
    streaks: [
        { id: 'streak_shield_3', title: 'Pack 3 Boucliers de Flamme', desc: 'Protège votre série quotidienne en cas d oubli.', priceKevs: 200, icon: 'flame' }
    ],
    boosters: [
        { id: 'time_freeze_3', title: '3x Time-Freeze (+5s)', desc: 'Gèle le chrono pendant 5 secondes supplémentaires.', priceKevs: 45, type: 'timeFreeze', count: 3, icon: 'hourglass-outline' },
        { id: 'super_clue_3', title: '3x Super-Indice', desc: 'Élimine immédiatement 2 mauvais choix.', priceKevs: 75, type: 'superClue', count: 3, icon: 'bulb-outline' },
        { id: 'second_chance_2', title: '2x Seconde Chance', desc: 'Permet de continuer une partie après un Game Over.', priceKevs: 100, type: 'secondChance', count: 2, icon: 'refresh-circle-outline' }
    ],
    cosmetics: [
        { id: 'theme_cyberpunk', title: 'Thème Néon Cyberpunk', desc: 'Ambiance futuriste aux néons vibrants.', priceKevs: 300, type: 'theme', icon: 'color-palette-outline' },
        { id: 'frame_golden_crown', title: 'Cadre Couronne Dorée', desc: 'Une aura étincelante autour de votre avatar.', priceKevs: 250, type: 'frame', icon: 'sparkles-outline' }
    ]
};

exports.getCatalog = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        return res.status(200).json({
            status: 'success',
            data: {
                catalog: CATALOG,
                userKevs: user?.kevs || 0,
                streakFreezes: user?.streakFreezes || 0,
                isVip: Boolean(user?.isVip),
                inventory: user?.inventory || {}
            }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Erreur lors du chargement de la boutique.' });
    }
};

exports.buyWithKevs = async (req, res) => {
    try {
        const { itemId, category } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
        }

        let itemFound = null;
        let itemCost = 0;

        if (category === 'streaks') {
            itemFound = CATALOG.streaks.find(s => s.id === itemId);
            if (itemFound) itemCost = itemFound.priceKevs;
        } else if (category === 'boosters') {
            itemFound = CATALOG.boosters.find(b => b.id === itemId);
            if (itemFound) itemCost = itemFound.priceKevs;
        } else if (category === 'cosmetics') {
            itemFound = CATALOG.cosmetics.find(c => c.id === itemId);
            if (itemFound) itemCost = itemFound.priceKevs;
        }

        if (!itemFound) {
            return res.status(400).json({ status: 'fail', message: 'Article inexistant.' });
        }

        if (user.kevs < itemCost) {
            return res.status(400).json({ status: 'fail', message: 'Solde de Kevs insuffisant.' });
        }

        // Débit des Kevs
        user.kevs -= itemCost;

        // Attribution
        if (category === 'streaks') {
            user.streakFreezes = (user.streakFreezes || 0) + 3;
        } else if (category === 'boosters') {
            if (!user.inventory) user.inventory = { boosters: {} };
            if (!user.inventory.boosters) user.inventory.boosters = {};
            const currentCount = user.inventory.boosters[itemFound.type] || 0;
            user.inventory.boosters[itemFound.type] = currentCount + (itemFound.count || 1);
        } else if (category === 'cosmetics') {
            if (!user.inventory) user.inventory = { themes: [], avatarFrames: [] };
            if (itemFound.type === 'theme') {
                if (!user.inventory.themes) user.inventory.themes = [];
                if (!user.inventory.themes.includes(itemFound.id)) user.inventory.themes.push(itemFound.id);
            } else if (itemFound.type === 'frame') {
                if (!user.inventory.avatarFrames) user.inventory.avatarFrames = [];
                if (!user.inventory.avatarFrames.includes(itemFound.id)) user.inventory.avatarFrames.push(itemFound.id);
            }
        }

        await user.save();

        return res.status(200).json({
            status: 'success',
            message: `Achat réussi : ${itemFound.title}`,
            data: {
                userKevs: user.kevs,
                streakFreezes: user.streakFreezes,
                inventory: user.inventory
            }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.verifyPurchase = async (req, res) => {
    try {
        const { packId } = req.body;
        const user = await User.findById(req.user.id);

        if (packId === 'vip_monthly') {
            user.isVip = true;
            user.vipExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            user.kevs += 150; // Bonus immédiat
        } else {
            const pack = CATALOG.kevsPacks.find(p => p.id === packId);
            if (pack) {
                user.kevs += (pack.amount + pack.bonus);
            }
        }

        await user.save();

        return res.status(200).json({
            status: 'success',
            message: 'Achat In-App validé !',
            data: {
                userKevs: user.kevs,
                isVip: user.isVip
            }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Erreur lors de la validation d achat.' });
    }
};