const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { generateTravelSuggestions } = require('../services/travelSuggestions');
const { generateItinerary } = require('../services/itineraryBuilder');
const { logItineraryChange } = require('../services/activityLogger');
const { notifyTrip } = require('../services/notifications');

const router = express.Router();

// Get Socket.io instance (injected by server)
let io;
router.setIO = (socketIO) => {
  io = socketIO;
};

// Create a new trip
router.post('/', async (req, res) => {
  try {
    const { name, destination, origin, startDate, endDate } = req.body;
    const groupId = uuidv4();
    const userId = req.user.uid;

    // Get user email
    const user = await User.findOne({ uid: userId });
    const userEmail = user?.email || null;

    const trip = new Trip({
      name,
      groupId,
      destination,
      origin,
      startDate,
      endDate,
      createdBy: userId,
      members: [{ userId, email: userEmail, role: 'organizer', status: 'active' }],
    });

    await trip.save();
    ensureSuggestions(trip);

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

// Generate suggestions in the background once a destination exists; retry failures after a cooldown
const generating = new Set();
const RETRY_AFTER_MS = 30 * 1000;

function ensureSuggestions(trip) {
  const existing = trip.travelSuggestions;
  const hasResult = existing && !existing.error;
  const recentlyFailed = existing?.error && Date.now() - new Date(existing.failedAt || 0) < RETRY_AFTER_MS;
  const id = String(trip._id);

  if (hasResult || recentlyFailed || generating.has(id) || !trip.destination?.address) return;

  generating.add(id);
  (async () => {
    try {
      let suggestions = await generateTravelSuggestions(trip);
      if (suggestions.error) suggestions = { ...suggestions, failedAt: new Date() };
      await Trip.findByIdAndUpdate(trip._id, { travelSuggestions: suggestions });
    } catch (err) {
      console.error('Error in suggestions pipeline:', err.message);
    } finally {
      generating.delete(id);
    }
  })();
}

// Get a specific trip
router.get('/:groupId', async (req, res) => {
  try {
    const trip = await Trip.findOne({ groupId: req.params.groupId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    ensureSuggestions(trip);
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

// Set where the group is staying (used to make AI suggestions local and concrete)
router.put('/:groupId/accommodation', async (req, res) => {
  try {
    const trip = await Trip.findOne({ groupId: req.params.groupId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (!trip.members.some((m) => m.userId === req.user.uid && m.status === 'active')) {
      return res.status(403).json({ error: 'Not a member of this trip' });
    }

    const name = String(req.body?.name || '').trim().slice(0, 200);
    const address = String(req.body?.address || '').trim().slice(0, 300);
    trip.accommodation = { name, address };
    trip.travelSuggestions = null; // regenerated for the new area on next load
    trip.updatedAt = new Date();
    await trip.save();

    if (io) io.to(`trip:${trip.groupId}`).emit('trip:accommodationUpdated', { accommodation: trip.accommodation });
    res.json(trip.accommodation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate itinerary items with AI and add them to the trip
router.post('/:groupId/itinerary/generate', async (req, res) => {
  try {
    const trip = await Trip.findOne({ groupId: req.params.groupId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    if (!trip.members.some((m) => m.userId === req.user.uid)) {
      return res.status(403).json({ error: 'Not a member of this trip' });
    }
    if (!trip.destination?.address) {
      return res.status(400).json({ error: 'Trip needs a destination first' });
    }

    const items = await generateItinerary(trip, req.body?.preferences);
    if (items.length === 0) {
      return res.status(502).json({ error: 'AI did not return any stops. Please try again.' });
    }

    // Re-read so items added while the AI was working are not overwritten
    const fresh = await Trip.findOne({ groupId: req.params.groupId });
    const before = fresh.itinerary.length;
    items.forEach((item) =>
      fresh.itinerary.push({ ...item, createdBy: req.user.uid, createdAt: new Date(), version: 1 })
    );
    fresh.updatedAt = new Date();
    await fresh.save();

    const added = fresh.itinerary.slice(before);
    if (io) {
      added.forEach((item) =>
        io.to(`trip:${fresh.groupId}`).emit('itinerary:itemAdded', { item, addedBy: req.user.uid })
      );
    }

    res.status(201).json(added);
  } catch (error) {
    console.error('Itinerary generation error:', error.message);
    res.status(500).json({ error: 'Could not generate itinerary: ' + error.message });
  }
});

// Add itinerary item
router.post('/:groupId/itinerary', async (req, res) => {
  try {
    const { stop, time, transport, notes } = req.body;
    const trip = await Trip.findOne({ groupId: req.params.groupId });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const user = await User.findOne({ uid: req.user.uid });

    const itineraryItem = {
      stop,
      time: new Date(time),
      transport,
      notes,
      createdBy: req.user.uid,
      createdAt: new Date(),
      version: 1,
    };

    trip.itinerary.push(itineraryItem);
    trip.updatedAt = new Date();
    await trip.save();

    const addedItem = trip.itinerary[trip.itinerary.length - 1];

    // Log activity
    logItineraryChange(
      trip._id,
      trip.groupId,
      req.user.uid,
      user?.email,
      addedItem._id.toString(),
      'itinerary_added',
      null,
      `Added stop: ${stop}`
    ).catch((err) => console.error('Activity log error:', err.message));

    // Broadcast real-time event
    if (io) {
      io.to(`trip:${trip.groupId}`).emit('itinerary:itemAdded', {
        item: addedItem,
        addedBy: req.user.uid,
      });
    }

    notifyTrip(trip, req.user.uid, {
      title: trip.name,
      body: `${user?.email || 'Someone'} added a stop: ${stop}`,
    });

    res.status(201).json(addedItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update itinerary item
router.put('/:groupId/itinerary/:itemId', async (req, res) => {
  try {
    const { stop, time, transport, notes, version } = req.body;
    const trip = await Trip.findOne({ groupId: req.params.groupId });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const itineraryItem = trip.itinerary.id(req.params.itemId);
    if (!itineraryItem) {
      return res.status(404).json({ error: 'Itinerary item not found' });
    }

    // Check version for conflict detection
    const currentVersion = itineraryItem.version || 1;
    if (version && version !== currentVersion) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Item was updated by another user',
        currentVersion,
        expectedVersion: version,
      });
    }

    // Store old state for activity log
    const before = {
      stop: itineraryItem.stop,
      time: itineraryItem.time,
      transport: itineraryItem.transport,
      notes: itineraryItem.notes,
    };

    if (stop !== undefined) itineraryItem.stop = stop;
    if (time !== undefined) itineraryItem.time = new Date(time);
    if (transport !== undefined) itineraryItem.transport = transport;
    if (notes !== undefined) itineraryItem.notes = notes;

    itineraryItem.updatedBy = req.user.uid;
    itineraryItem.updatedAt = new Date();
    itineraryItem.version = (currentVersion || 1) + 1;

    trip.updatedAt = new Date();
    await trip.save();

    const user = await User.findOne({ uid: req.user.uid });

    // Log activity
    logItineraryChange(
      trip._id,
      trip.groupId,
      req.user.uid,
      user?.email,
      req.params.itemId,
      'itinerary_updated',
      { before, after: { stop, time, transport, notes } },
      `Updated stop: ${stop}`
    ).catch((err) => console.error('Activity log error:', err.message));

    // Broadcast real-time event
    if (io) {
      io.to(`trip:${trip.groupId}`).emit('itinerary:itemUpdated', {
        itemId: req.params.itemId,
        item: itineraryItem,
        updatedBy: req.user.uid,
        version: itineraryItem.version,
      });
    }

    notifyTrip(trip, req.user.uid, {
      title: trip.name,
      body: `Stop updated: ${itineraryItem.stop}`,
    });

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

    const deletedItem = trip.itinerary.id(req.params.itemId);
    if (!deletedItem) {
      return res.status(404).json({ error: 'Itinerary item not found' });
    }

    trip.itinerary = trip.itinerary.filter(
      (item) => item._id.toString() !== req.params.itemId
    );
    trip.updatedAt = new Date();
    await trip.save();

    const user = await User.findOne({ uid: req.user.uid });

    // Log activity
    logItineraryChange(
      trip._id,
      trip.groupId,
      req.user.uid,
      user?.email,
      req.params.itemId,
      'itinerary_deleted',
      { deleted: deletedItem },
      `Deleted stop: ${deletedItem.stop}`
    ).catch((err) => console.error('Activity log error:', err.message));

    // Broadcast real-time event
    if (io) {
      io.to(`trip:${trip.groupId}`).emit('itinerary:itemDeleted', {
        itemId: req.params.itemId,
        deletedBy: req.user.uid,
      });
    }

    notifyTrip(trip, req.user.uid, {
      title: trip.name,
      body: `Stop removed: ${deletedItem.stop}`,
    });

    res.json({ message: 'Itinerary item deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
