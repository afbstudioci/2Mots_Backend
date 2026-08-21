//src/controllers/shopController.js
const User = require('../models/User');

const CATALOG = {
    vip: {
        id: 'vip_monthly',
        title: 'Pass VIP 2Mots',
        priceEur: '2,99 €',
        perks: [
            'Zéro publicité dans tout le jeu',
            '15 Kevs offerts chaque jour',
            'Double XP & Récompenses ×2 permanentes',
            '1 Seconde Chance offerte à chaque partie'
        ]
    },
    kevsPacks: [
        { id: 'kevs_150', title: 'Poignée de Kevs', amount: 150, bonus: 0, priceEur: '0,99 €', icon: 'diamond-outline' },
        { id: 'kevs_700', title: 'Bourse de Réflexion', amount: 600, bonus: 100, priceEur: '2,99 €', tag: 'POPULAIRE', icon: 'diamond' },
        { id: 'kevs_3000', title: 'Coffre du Maître', amount: 2500, bonus: 500, priceEur: '9,99 €', tag: 'MEILLEURE VALEUR', icon: 'trophy' }
    ],
    streaks: [
        { id: 'streak_shield_3', title: 'Pack 3 Boucliers de Flamme', desc: "Protège votre série quotidienne en cas d'oubli.", priceKevs: 200, icon: 'flame', accentColor: '#F97316' }
    ],
    boosters: [
        { id: 'time_freeze_3', title: '3x Time-Freeze (+5s)', desc: 'Gèle le chrono pendant 5 secondes.', priceKevs: 45, type: 'timeFreeze', count: 3, icon: 'hourglass-outline', accentColor: '#0EA5E9' },
        { id: 'super_clue_3', title: '3x Super-Indice', desc: 'Élimine immédiatement 2 mauvais choix.', priceKevs: 75, type: 'superClue', count: 3, icon: 'bulb-outline', accentColor: '#F59E0B' },
        { id: 'second_chance_2', title: '2x Seconde Chance', desc: 'Permet de continuer une partie après un Game Over.', priceKevs: 100, type: 'secondChance', count: 2, icon: 'refresh-circle-outline', accentColor: '#10B981' }
    ],
    combos: [
        {
            id: 'pack_mega_joker',
            title: 'Méga Pack Joker (-30%)',
            desc: '5x Time-Freeze + 5x Super-Indice + 3x Seconde Chance.',
            priceKevs: 250,
            icon: 'gift-outline',
            accentColor: '#8B5CF6',
            rewards: { timeFreeze: 5, superClue: 5, secondChance: 3 }
        },
        {
            id: 'pack_survival_master',
            title: 'Pack Survie & Flammes',
            desc: '3x Seconde Chance + 3x Boucliers de Flamme.',
            priceKevs: 350,
            icon: 'shield-checkmark-outline',
            accentColor: '#EC4899',
            rewards: { secondChance: 3, streakFreezes: 3 }
        }
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
                inventory: user?.inventory || { boosters: { timeFreeze: 2, superClue: 2, secondChance: 1 } }
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
        } else if (category === 'combos') {
            itemFound = CATALOG.combos.find(c => c.id === itemId);
            if (itemFound) itemCost = itemFound.priceKevs;
        }

        if (!itemFound) {
            return res.status(400).json({ status: 'fail', message: 'Article inexistant.' });
        }

        if (user.kevs < itemCost) {
            return res.status(400).json({ status: 'fail', message: 'Solde de Kevs insuffisant.' });
        }

        user.kevs -= itemCost;

        if (!user.inventory) user.inventory = { boosters: { timeFreeze: 0, superClue: 0, secondChance: 0 } };
        if (!user.inventory.boosters) user.inventory.boosters = { timeFreeze: 0, superClue: 0, secondChance: 0 };

        if (category === 'streaks') {
            user.streakFreezes = (user.streakFreezes || 0) + 3;
        } else if (category === 'boosters') {
            const currentCount = user.inventory.boosters[itemFound.type] || 0;
            user.inventory.boosters[itemFound.type] = currentCount + (itemFound.count || 1);
        } else if (category === 'combos' && itemFound.rewards) {
            if (itemFound.rewards.timeFreeze) {
                user.inventory.boosters.timeFreeze = (user.inventory.boosters.timeFreeze || 0) + itemFound.rewards.timeFreeze;
            }
            if (itemFound.rewards.superClue) {
                user.inventory.boosters.superClue = (user.inventory.boosters.superClue || 0) + itemFound.rewards.superClue;
            }
            if (itemFound.rewards.secondChance) {
                user.inventory.boosters.secondChance = (user.inventory.boosters.secondChance || 0) + itemFound.rewards.secondChance;
            }
            if (itemFound.rewards.streakFreezes) {
                user.streakFreezes = (user.streakFreezes || 0) + itemFound.rewards.streakFreezes;
            }
        }

        user.markModified('inventory');
        await user.save();

        return res.status(200).json({
            status: 'success',
            message: 'Achat réussi : ' + itemFound.title,
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

exports.verifyInAppPurchase = async (req, res) => {
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

        user.markModified('inventory');
        await user.save();

        return res.status(200).json({
            status: 'success',
            message: 'Achat In-App validé avec succès !',
            data: {
                userKevs: user.kevs,
                isVip: user.isVip,
                vipExpiresAt: user.vipExpiresAt
            }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: "Erreur lors de la validation d'achat." });
    }
};

exports.useBooster = async (req, res) => {
    try {
        const { boosterType } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

        if (!user.inventory) user.inventory = { boosters: { timeFreeze: 0, superClue: 0, secondChance: 0 } };
        if (!user.inventory.boosters) user.inventory.boosters = { timeFreeze: 0, superClue: 0, secondChance: 0 };

        const available = user.inventory.boosters[boosterType] || 0;

        if (available > 0) {
            user.inventory.boosters[boosterType] = available - 1;
        } else {
            const cost = boosterType === 'secondChance' ? 30 : (boosterType === 'superClue' ? 25 : 15);
            if (user.kevs < cost) {
                return res.status(400).json({ status: 'fail', message: "Kevs insuffisants (" + cost + " requis)." });
            }
            user.kevs -= cost;
        }

        user.markModified('inventory');
        await user.save();

        return res.status(200).json({
            status: 'success',
            data: {
                boosterType,
                remainingCount: user.inventory.boosters[boosterType] || 0,
                userKevs: user.kevs
            }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};