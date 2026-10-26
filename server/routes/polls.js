const express = require('express');
const Trip = require('../models/Trip');
const Poll = require('../models/Poll');
const { notifyTrip } = require('../services/notifications');

const router = express.Router();

let io;
router.setIO = (socketIO) => {
  io = socketIO;
};

const MAX_OPTIONS = 10;

function isActiveMember(trip, uid) {
  return trip.members.some((m) => m.userId === uid && m.status === 'active');
}

function isOrganizer(trip, uid) {
  return trip.members.some((m) => m.userId === uid && m.role === 'organizer');
}

// Load trip by groupId and ensure the caller is an active member
async function loadTrip(req, res) {
  const trip = await Trip.findOne({ groupId: req.params.groupId });
  if (!trip) {
    res.status(404).json({ error: 'Trip not found' });
    return null;
  }
  if (!isActiveMember(trip, req.user.uid)) {
    res.status(403).json({ error: 'Not a member of this trip' });
    return null;
  }
  return trip;
}

function broadcast(trip, event, payload) {
  if (io) io.to(`trip:${trip.groupId}`).emit(event, payload);
}

// List polls for a trip
router.get('/trip/:groupId', async (req, res) => {
  try {
    const trip = await loadTrip(req, res);
    if (!trip) return;
    const polls = await Poll.find({ tripId: trip._id }).sort({ createdAt: -1 });
    res.json(polls);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create a poll
router.post('/trip/:groupId', async (req, res) => {
  try {
    const trip = await loadTrip(req, res);
    if (!trip) return;

    const { question, options, allowMultiple } = req.body;
    const texts = Array.isArray(options)
      ? [...new Set(options.filter((o) => typeof o === 'string').map((o) => o.trim()).filter(Boolean))]
      : [];

    if (typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }
    if (texts.length < 2 || texts.length > MAX_OPTIONS) {
      return res.status(400).json({ error: `Provide between 2 and ${MAX_OPTIONS} unique options` });
    }

    const poll = await Poll.create({
      tripId: trip._id,
      groupId: trip.groupId,
      question: question.trim(),
      options: texts.map((text) => ({ text, votes: [] })),
      allowMultiple: Boolean(allowMultiple),
      createdBy: req.user.uid,
    });

    broadcast(trip, 'poll:created', { poll });
    notifyTrip(trip, req.user.uid, { title: `New poll in ${trip.name}`, body: poll.question });
    res.status(201).json(poll);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Cast, change or withdraw a vote on an option (toggles for multi-choice polls)
router.post('/trip/:groupId/:pollId/vote', async (req, res) => {
  try {
    const trip = await loadTrip(req, res);
    if (!trip) return;

    const poll = await Poll.findOne({ _id: req.params.pollId, tripId: trip._id });
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.status === 'closed') return res.status(409).json({ error: 'Poll is closed' });

    const option = poll.options.id(req.body.optionId);
    if (!option) return res.status(400).json({ error: 'Invalid option' });

    const uid = req.user.uid;
    const alreadyVoted = option.votes.includes(uid);

    if (!poll.allowMultiple) {
      poll.options.forEach((o) => {
        o.votes = o.votes.filter((v) => v !== uid);
      });
    }
    if (alreadyVoted) {
      option.votes = option.votes.filter((v) => v !== uid);
    } else {
      option.votes.push(uid);
    }

    await poll.save();
    broadcast(trip, 'poll:updated', { poll });
    res.json(poll);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Close a poll (creator or organizer)
router.post('/trip/:groupId/:pollId/close', async (req, res) => {
  try {
    const trip = await loadTrip(req, res);
    if (!trip) return;

    const poll = await Poll.findOne({ _id: req.params.pollId, tripId: trip._id });
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.createdBy !== req.user.uid && !isOrganizer(trip, req.user.uid)) {
      return res.status(403).json({ error: 'Only the creator or an organizer can close this poll' });
    }

    poll.status = 'closed';
    poll.closedAt = new Date();
    await poll.save();
    broadcast(trip, 'poll:updated', { poll });
    res.json(poll);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a poll (creator or organizer)
router.delete('/trip/:groupId/:pollId', async (req, res) => {
  try {
    const trip = await loadTrip(req, res);
    if (!trip) return;

    const poll = await Poll.findOne({ _id: req.params.pollId, tripId: trip._id });
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.createdBy !== req.user.uid && !isOrganizer(trip, req.user.uid)) {
      return res.status(403).json({ error: 'Only the creator or an organizer can delete this poll' });
    }

    await poll.deleteOne();
    broadcast(trip, 'poll:deleted', { pollId: String(poll._id) });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
