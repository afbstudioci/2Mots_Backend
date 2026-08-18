//src/workers/aiWordGenerator.js
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WordPair = require('../models/WordPair');
const { geminiApiKey, geminiModel } = require('../config/env');

const DB_WORD_LIMIT = 50000;

const generateAndSaveWords = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] Cle API Gemini absente. Generation annulee.");
        return;
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    const tiers = [
        { difficulty: "FACILE (niveaux 1 a 3)", targetDiff: 2 },
        { difficulty: "MOYEN (niveaux 4 a 6)", targetDiff: 5 },
        { difficulty: "DIFFICILE (niveaux 7 a 10)", targetDiff: 8 }
    ];

    try {
        console.log(`[WORKER] Lancement de la generation IA Lead Game Designer (Modele : ${geminiModel})...`);

        for (const tier of tiers) {
            const prompt = `Tu es le Lead Game Designer du jeu mobile de reflexion en francais "2Mots".
Dans ce jeu, le joueur voit deux mots (\`word1\`, \`word2\`) et un indice (\`clue\`), puis doit identifier le mot unique (\`exactMatch\`) qui les relie logiquement parmi un choix multiple compose de la solution et de 2 distracteurs (\`distractors\`).

---

### MISSION :
Genere un tableau JSON valide de 20 enigmes equilibrees.
Niveau de difficulte cible : ${tier.difficulty}.

---

### REGLES STRICTES DE CONCEPTION :

1. LOGIQUE & CONCRET :
   - Les associations doivent reposer sur des concepts du quotidien, la nature, des objets, des metiers ou des actions concretes.
   - Bannis toute abstraction philosophique ou association tiree par les cheveux.

2. REGLES SUR LA SOLUTION (\`exactMatch\`) :
   - \`exactMatch\` contient un tableau avec une seule chaine : la solution unique.
   - Doit etre en minuscules, sans article/determinant (ex: "plage", pas "la plage").
   - Ne doit JAMAIS etre identique ou de la meme racine morphologique que \`word1\` ou \`word2\`.

3. REGLES SUR LES DISTRACTEURS (\`distractors\`) :
   - Doit contenir exactement 2 chaines distinctes.
   - Meme nature grammaticale : Si la solution est un verbe a l'infinitif, les 2 distracteurs DOIVENT etre des verbes a l'infinitif. Idem pour les noms (au singulier) et les adjectifs (au masculin singulier).
   - Thematiques mais faux : Les distracteurs doivent appartenir a l'univers semantique de l'enigme pour sembler plausibles au premier coup d'oeil, mais etre strictement invalides par l'indice ou l'un des deux mots.
   - Zero synonyme : Un distracteur ne doit JAMAIS etre une reponse valide alternative (ex: si la solution est "couper", interdiction d'utiliser "trancher" ou "scier").

4. NATURE GRAMMATICALE (\`expectedType\`) :
   - Valeurs autorisees uniquement : "nom", "verbe", "adjectif".
   - Tous les verbes doivent etre a l'infinitif.

5. INDICE (\`clue\`) :
   - Une phrase courte ou definition concise (max 10 mots) qui guide precisement vers la solution sans la nommer.

---

### EXEMPLES FEW-SHOT :

[
  {
    "word1": "Abeille",
    "word2": "Fleur",
    "clue": "Action de recolter le nectar",
    "expectedType": "verbe",
    "difficulty": 2,
    "exactMatch": ["butiner"],
    "distractors": ["piquer", "semer"]
  },
  {
    "word1": "Soleil",
    "word2": "Mer",
    "clue": "Etendue de sable au bord de l'eau",
    "expectedType": "nom",
    "difficulty": 1,
    "exactMatch": ["plage"],
    "distractors": ["piscine", "desert"]
  },
  {
    "word1": "Farine",
    "word2": "Four",
    "clue": "Aliment de base cuit a croute doree",
    "expectedType": "nom",
    "difficulty": 2,
    "exactMatch": ["pain"],
    "distractors": ["gateau", "pate"]
  }
]

---

### FORMAT DE SORTIE :
- Reponds UNIQUEMENT avec le tableau JSON brut.
- Pas de texte avant, pas de texte apres, pas de balises Markdown.

Schema d'un objet :
{
  "word1": "string",
  "word2": "string",
  "clue": "string",
  "expectedType": "nom" | "verbe" | "adjectif",
  "difficulty": number,
  "exactMatch": ["string"],
  "distractors": ["string", "string"]
}`;

            const result = await model.generateContent(prompt);
            let responseText = result.response.text();

            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedData = JSON.parse(responseText);

            if (Array.isArray(parsedData) && parsedData.length > 0) {
                const validatedData = parsedData.filter(item => {
                    const sol = (item.exactMatch && item.exactMatch[0] || '').toLowerCase();
                    const w1 = (item.word1 || '').toLowerCase();
                    const w2 = (item.word2 || '').toLowerCase();
                    const hasDistractors = Array.isArray(item.distractors) && item.distractors.length >= 2;
                    return sol && sol !== w1 && sol !== w2 && hasDistractors;
                }).map(item => ({
                    ...item,
                    difficulty: item.difficulty || tier.targetDiff,
                    isActive: true,
                }));

                if (validatedData.length > 0) {
                    await WordPair.insertMany(validatedData, { ordered: false });
                    console.log(`[WORKER] ${validatedData.length} enigmes de haute precision inserees pour ${tier.difficulty}.`);
                }
            }
        }
    } catch (error) {
        console.error('[WORKER] Erreur lors de la generation IA :', error.message);
    }
};

const initializeWordDatabase = async () => {
    try {
        const count = await WordPair.countDocuments();
        if (count < DB_WORD_LIMIT) {
            console.log(`[WORKER] Base de donnees (${count}/${DB_WORD_LIMIT})...`);
            await generateAndSaveWords();
        }
    } catch (error) {
        console.error('[WORKER] Erreur de verification :', error.message);
    }
};

const initAiWorker = async () => {
    if (!geminiApiKey) {
        console.warn("[WORKER] Cle API Gemini absente.");
        return;
    }

    initializeWordDatabase();

    cron.schedule('0 */2 * * *', async () => {
        await initializeWordDatabase();
    });

    console.log('[WORKER] Generateur IA Lead Game Designer active.');
};

module.exports = initAiWorker;