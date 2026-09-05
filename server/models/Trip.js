const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  groupId: {
    type: String,
    required: true,
    unique: true,
  },
  destination: {
    lat: Number,
    lng: Number,
    address: String,
  },
  origin: {
    lat: Number,
    lng: Number,
    address: String,
  },
  startDate: Date,
  endDate: Date,
  members: [
    {
      userId: String,
      role: {
        type: String,
        enum: ['organizer', 'member'],
        default: 'member',
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  itinerary: [
    {
      stop: String,
      time: Date,
      transport: String,
      notes: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdBy: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  travelSuggestions: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
});

tripSchema.index({ groupId: 1 });
tripSchema.index({ createdBy: 1 });
tripSchema.index({ 'members.userId': 1 });

module.exports = mongoose.model('Trip', tripSchema);
