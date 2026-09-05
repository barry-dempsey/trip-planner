const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function generateTravelSuggestions(trip) {
  try {
    console.log('Starting travel suggestions generation...');
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const prompt = `You are a travel expert. Generate travel suggestions for this trip:

Trip Name: ${trip.name}
Origin: ${trip.origin?.address || 'Unknown'}
Destination: ${trip.destination?.address || 'Unknown'}
Start Date: ${new Date(trip.startDate).toLocaleDateString()}

Provide practical travel options with:
- Best transportation methods
- Estimated costs and duration
- Booking tips
- Journey advice`;

    console.log('Calling Gemini API...');
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('Gemini response received');

    return { raw_suggestions: text };
  } catch (error) {
    console.error('Error generating travel suggestions:', error.message);
    return { error: error.message || 'Could not generate suggestions' };
  }
}

module.exports = { generateTravelSuggestions };
