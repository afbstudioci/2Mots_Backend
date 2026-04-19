//src/workers/aiWordGenerator.js
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const WordPair = require('../models/WordPair');

const initAiWorker = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[WORKER] API Key Gemini absente. Generateur IA inactif.");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[WORKER] Demarrage de la generation de nouveaux mots...');
      
      const prompt = `Génère 60 paires de mots en français pour un jeu de réflexion. 
      L'utilisateur doit deviner le lien logique entre "word1" et "word2".
      Tu dois fournir la nature grammaticale dans "expectedType" (ex: "Nom commun", "Verbe", "Adjectif").
      Tu dois fournir les réponses acceptées dans 3 catégories :
      - exactMatch : La réponse parfaite.
      - closeMatch : Synonymes très proches (80% de précision).
      - partialMatch : Concept lié (50% de précision).
      
      Renvoie UNIQUEMENT un tableau JSON valide. Pas de texte autour. 
      Format attendu :
      [
        {
          "word1": "Océan",
          "word2": "Ciel",
          "clue": "Couleur dominante",
          "expectedType": "Adjectif",
          "exactMatch": ["bleu"],
          "closeMatch": ["bleuté", "azur"],
          "partialMatch": ["cyan", "couleur"]
        }
      ]`;

      const result = await model.generateContent(prompt);
      let responseText = result.response.text();
      responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedData = JSON.parse(responseText);

      if (Array.isArray(parsedData) && parsedData.length > 0) {
        await WordPair.insertMany(parsedData, { ordered: false });
        console.log(`[WORKER] Succes : ${parsedData.length} nouveaux mots injectes dans MongoDB.`);
      }
    } catch (error) {
      console.error('[WORKER] Erreur lors de la generation IA :', error.message);
    }
  });

  console.log('[WORKER] Generateur IA arme et planifie.');
};

module.exports = initAiWorker;