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
      email: String,
      role: {
        type: String,
        enum: ['organizer', 'member'],
        default: 'member',
      },
      status: {
        type: String,
        enum: ['pending', 'active', 'removed'],
        default: 'active',
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      invitedBy: String,
      invitedAt: Date,
      inviteAccepted: Date,
    },
  ],
  itinerary: [
    {
      stop: String,
      time: Date,
      transport: String,
      notes: String,
      createdBy: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
      updatedBy: String,
      updatedAt: Date,
      version: {
        type: Number,
        default: 1,
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
