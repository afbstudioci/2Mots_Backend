//src/controllers/shopController.js
const User = require('../models/User');

const CATALOG = {
    vip: {
        id: 'vip_monthly',
        title: 'Pass VIP 2Mots',
        priceEur: '2,99 EUR',
        period: 'par mois',
        perks: [
            'Zero publicite dans tout le jeu',
            '15 Kevs offerts chaque jour',
            'Badge dore et Couronne de prestige',
            'Acces illimite au mode Entrainement'
        ]
    },
    kevsPacks: [
        { id: 'kevs_150', title: 'Poignee de Kevs', amount: 150, bonus: 0, priceEur: '0,99 EUR', icon: 'diamond-outline' },
        { id: 'kevs_700', title: 'Bourse de Reflexion', amount: 600, bonus: 100, priceEur: '2,99 EUR', tag: 'POPULAIRE', icon: 'diamond' },
        { id: 'kevs_3000', title: 'Coffre du Maitre', amount: 2500, bonus: 500, priceEur: '9,99 EUR', tag: 'MEILLEURE VALEUR', icon: 'trophy' }
    ],
    streaks: [
        { id: 'streak_shield_3', title: 'Pack 3 Boucliers de Flamme', desc: 'Protege votre serie quotidienne en cas d''oubli.', priceKevs: 200, icon: 'flame' }
    ],
    boosters: [
        { id: 'time_freeze_3', title: '3x Time-Freeze (+5s)', desc: 'Gele le chrono pendant 5 secondes.', priceKevs: 45, type: 'timeFreeze', count: 3, icon: 'hourglass-outline' },
        { id: 'super_clue_3', title: '3x Super-Indice', desc: 'Elimine immediatement 2 mauvais choix.', priceKevs: 75, type: 'superClue', count: 3, icon: 'bulb-outline' },
        { id: 'second_chance_2', title: '2x Seconde Chance', desc: 'Permet de continuer une partie apres un Game Over.', priceKevs: 100, type: 'secondChance', count: 2, icon: 'refresh-circle-outline' }
    ],
    cosmetics: [
        { id: 'theme_cyberpunk', title: 'Theme Neon Cyberpunk', desc: 'Ambiance futuriste aux neons vibrants.', priceKevs: 300, type: 'theme', icon: 'color-palette-outline' },
        { id: 'frame_golden_crown', title: 'Cadre Couronne Doree', desc: 'Une aura etincelante autour de votre avatar.', priceKevs: 250, type: 'frame', icon: 'sparkles-outline' }
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
                inventory: user?.inventory || { boosters: { timeFreeze: 2, superClue: 2, secondChance: 1 } },
                equippedFrame: user?.equippedFrame || null,
                equippedTheme: user?.equippedTheme || null
            }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Erreur chargement boutique.' });
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

        user.kevs -= itemCost;

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
                user.equippedTheme = itemFound.id;
            } else if (itemFound.type === 'frame') {
                if (!user.inventory.avatarFrames) user.inventory.avatarFrames = [];
                if (!user.inventory.avatarFrames.includes(itemFound.id)) user.inventory.avatarFrames.push(itemFound.id);
                user.equippedFrame = itemFound.id;
            }
        }

        await user.save();

        return res.status(200).json({
            status: 'success',
            message: `Achat reussi : ${itemFound.title}`,
            data: {
                userKevs: user.kevs,
                streakFreezes: user.streakFreezes,
                inventory: user.inventory,
                equippedFrame: user.equippedFrame,
                equippedTheme: user.equippedTheme
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

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
        }

        if (packId === 'vip_monthly' || packId === 'vip') {
            user.isVip = true;
            user.vipExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            user.kevs = (user.kevs || 0) + 150;
        } else {
            const pack = CATALOG.kevsPacks.find(p => p.id === packId);
            if (pack) {
                user.kevs = (user.kevs || 0) + (pack.amount + pack.bonus);
            } else {
                user.kevs = (user.kevs || 0) + 200;
            }
        }

        await user.save();

        return res.status(200).json({
            status: 'success',
            message: 'Achat In-App valide avec succes !',
            data: {
                userKevs: user.kevs,
                isVip: user.isVip,
                vipExpiresAt: user.vipExpiresAt
            }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Erreur lors de la validation d''achat.' });
    }
};

exports.useBooster = async (req, res) => {
    try {
        const { boosterType } = req.body; // 'timeFreeze' | 'superClue' | 'secondChance'
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

        const available = user.inventory?.boosters?.[boosterType] || 0;

        if (available > 0) {
            user.inventory.boosters[boosterType] -= 1;
        } else {
            // Achat a la volee par Kevs
            const cost = boosterType === 'secondChance' ? 30 : (boosterType === 'superClue' ? 25 : 15);
            if (user.kevs < cost) {
                return res.status(400).json({ status: 'fail', message: `Kevs insuffisants (${cost} requis).` });
            }
            user.kevs -= cost;
        }

        await user.save();

        return res.status(200).json({
            status: 'success',
            data: {
                userKevs: user.kevs,
                inventory: user.inventory
            }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.equipCosmetic = async (req, res) => {
    try {
        const { type, itemId } = req.body; // type: 'frame' | 'theme'
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

        if (type === 'frame') {
            user.equippedFrame = itemId || null;
        } else if (type === 'theme') {
            user.equippedTheme = itemId || null;
        }

        await user.save();

        return res.status(200).json({
            status: 'success',
            data: {
                equippedFrame: user.equippedFrame,
                equippedTheme: user.equippedTheme
            }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};