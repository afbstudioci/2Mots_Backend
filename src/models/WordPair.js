const mongoose = require('mongoose');

const wordPairSchema = new mongoose.Schema({
  word1: { type: String, required: true, trim: true, lowercase: true },
  icon1: { type: String, default: '💡' }, // Emoji pour le mot 1
  word2: { type: String, required: true, trim: true, lowercase: true },
  icon2: { type: String, default: '💡' }, // Emoji pour le mot 2
  clue: { type: String, required: true, trim: true },
  expectedType: { type: String, required: true, trim: true },
  exactMatch: [{ type: String, lowercase: true, trim: true }],
  closeMatch: [{ type: String, lowercase: true, trim: true }],
  partialMatch: [{ type: String, lowercase: true, trim: true }],
  difficulty: { type: Number, default: 1, min: 1, max: 5 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

wordPairSchema.index({ isActive: 1, _id: 1 });

module.exports = mongoose.model('WordPair', wordPairSchema);