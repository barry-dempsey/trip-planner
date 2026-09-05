const express = require('express');
const TripComment = require('../models/TripComment');
const Trip = require('../models/Trip');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Get all comments for a trip
router.get('/trip/:tripId', async (req, res) => {
  try {
    const comments = await TripComment.find({ tripId: req.params.tripId }).sort({ createdAt: -1 });
    res.json(comments);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Ask a question about a trip
router.post('/trip/:tripId', async (req, res) => {
  try {
    const { question } = req.body;
    const tripId = req.params.tripId;
    const userId = req.user.uid;

    // Validate trip exists
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Create comment with question
    const comment = new TripComment({
      tripId,
      userId,
      question,
    });

    await comment.save();

    // Generate answer from Claude
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const prompt = `The user is planning a trip from ${trip.origin?.address} to ${trip.destination?.address} departing on ${new Date(trip.startDate).toLocaleDateString()}.

Here are the AI travel suggestions:
${trip.travelSuggestions?.raw_suggestions || 'No suggestions available'}

User's question: ${question}

Provide a helpful, concise answer about their trip. Keep it to 2-3 sentences.`;

      const result = await model.generateContent(prompt);
      const answer = result.response.text();

      comment.answer = answer;
      comment.answeredAt = new Date();
      await comment.save();
    } catch (err) {
      console.error('Error generating answer:', err.message);
      comment.answer = 'Unable to generate answer at this moment. Please try again.';
      await comment.save();
    }

    res.status(201).json(comment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
