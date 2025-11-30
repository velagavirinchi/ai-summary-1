const mongoose = require('mongoose');
const ArticleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  url: { type: String, required: true },
  title: { type: String, default: 'Processing...' },
  summary: { type: String },
  topics: [String],
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Article', ArticleSchema);