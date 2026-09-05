const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Trip = require('../models/Trip');
const { generateTravelSuggestions } = require('../services/travelSuggestions');

const router = express.Router();

// Create a new trip
router.post('/', async (req, res) => {
  try {
    const { name, destination, origin, startDate, endDate } = req.body;
    const groupId = uuidv4();
    const userId = req.user.uid;

    const trip = new Trip({
      name,
      groupId,
      destination,
      origin,
      startDate,
      endDate,
      createdBy: userId,
      members: [{ userId, role: 'organizer' }],
    });

    await trip.save();
    const tripId = trip._id;

    // Generate travel suggestions asynchronously (fire and forget)
    (async () => {
      try {
        console.log('Starting async suggestions for trip:', tripId);
        const suggestions = await generateTravelSuggestions(trip);
        console.log('Got suggestions, updating database...');
        const updated = await Trip.findByIdAndUpdate(tripId, { travelSuggestions: suggestions });
        console.log('Trip updated successfully:', updated ? 'yes' : 'no');
      } catch (err) {
        console.error('Error in suggestions pipeline:', err.message);
      }
    })();

    res.status(201).json(trip);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all trips for the user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.uid;
    const trips = await Trip.find({ 'members.userId': userId });
    res.json(trips);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get a specific trip
router.get('/:groupId', async (req, res) => {
  try {
    const trip = await Trip.findOne({ groupId: req.params.groupId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a trip
router.put('/:groupId', async (req, res) => {
  try {
    const { name, destination, origin, startDate, endDate } = req.body;
    const trip = await Trip.findOneAndUpdate(
      { groupId: req.params.groupId },
      {
        name,
        destination,
        origin,
        startDate,
        endDate,
        updatedAt: new Date(),
      },
      { new: true }
    );
    res.json(trip);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a trip
router.delete('/:groupId', async (req, res) => {
  try {
    await Trip.deleteOne({ groupId: req.params.groupId });
    res.json({ message: 'Trip deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add itinerary item
router.post('/:groupId/itinerary', async (req, res) => {
  try {
    const { stop, time, transport, notes } = req.body;
    const trip = await Trip.findOne({ groupId: req.params.groupId });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const itineraryItem = {
      stop,
      time: new Date(time),
      transport,
      notes,
    };

    trip.itinerary.push(itineraryItem);
    trip.updatedAt = new Date();
    await trip.save();

    res.status(201).json(trip.itinerary[trip.itinerary.length - 1]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update itinerary item
router.put('/:groupId/itinerary/:itemId', async (req, res) => {
  try {
    const { stop, time, transport, notes } = req.body;
    const trip = await Trip.findOne({ groupId: req.params.groupId });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const itineraryItem = trip.itinerary.id(req.params.itemId);
    if (!itineraryItem) {
      return res.status(404).json({ error: 'Itinerary item not found' });
    }

    if (stop !== undefined) itineraryItem.stop = stop;
    if (time !== undefined) itineraryItem.time = new Date(time);
    if (transport !== undefined) itineraryItem.transport = transport;
    if (notes !== undefined) itineraryItem.notes = notes;

    trip.updatedAt = new Date();
    await trip.save();

    res.json(itineraryItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete itinerary item
router.delete('/:groupId/itinerary/:itemId', async (req, res) => {
  try {
    const trip = await Trip.findOne({ groupId: req.params.groupId });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    trip.itinerary = trip.itinerary.filter(
      (item) => item._id.toString() !== req.params.itemId
    );
    trip.updatedAt = new Date();
    await trip.save();

    res.json({ message: 'Itinerary item deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
