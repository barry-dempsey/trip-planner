const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
  },
  groupId: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  amountCents: {
    type: Number,
    required: true,
    min: 1,
    validate: Number.isInteger,
  },
  currency: {
    type: String,
    default: 'EUR',
    uppercase: true,
    maxlength: 3,
  },
  paidBy: {
    type: String,
    required: true,
  },
  splitAmong: {
    type: [String],
    validate: (v) => v.length > 0,
  },
  createdBy: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

expenseSchema.index({ tripId: 1, createdAt: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
