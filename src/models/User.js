//src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  username: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user'
  },
  bestScore: {
    type: Number,
    default: 0
  },
  kevs: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  playedWords: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WordPair'
  }],
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Indexation pour purger rapidement le tableau si necessaire
userSchema.index({ playedWords: 1 });

const User = mongoose.model('User', userSchema);
module.exports = User;