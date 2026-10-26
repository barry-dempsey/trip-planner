const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
  },
  groupId: {
    type: String,
    required: true,
  },
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300,
  },
  options: [
    {
      text: { type: String, required: true, trim: true, maxlength: 200 },
      votes: [String], // user ids
    },
  ],
  allowMultiple: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
  },
  createdBy: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  closedAt: Date,
});

pollSchema.index({ tripId: 1, createdAt: -1 });

module.exports = mongoose.model('Poll', pollSchema);
