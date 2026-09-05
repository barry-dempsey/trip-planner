const express = require('express');
const Trip = require('../models/Trip');

const router = express.Router();

// Add a member to a trip
router.post('/:groupId/members', async (req, res) => {
  try {
    const { userId } = req.body;
    const trip = await Trip.findOne({ groupId: req.params.groupId });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const memberExists = trip.members.some((m) => m.userId === userId);
    if (memberExists) {
      return res.status(400).json({ error: 'Member already in trip' });
    }

    trip.members.push({ userId, role: 'member' });
    trip.updatedAt = new Date();
    await trip.save();

    res.json(trip);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Remove a member from a trip
router.delete('/:groupId/members/:userId', async (req, res) => {
  try {
    const trip = await Trip.findOne({ groupId: req.params.groupId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    trip.members = trip.members.filter((m) => m.userId !== req.params.userId);
    trip.updatedAt = new Date();
    await trip.save();

    res.json(trip);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get trip members
router.get('/:groupId/members', async (req, res) => {
  try {
    const trip = await Trip.findOne({ groupId: req.params.groupId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    res.json(trip.members);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
