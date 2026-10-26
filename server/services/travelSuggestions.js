const { generateText } = require('./ai');

async function generateTravelSuggestions(trip) {
  try {
    console.log('Starting travel suggestions generation...');
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

    console.log('Calling OpenAI API...');
    const text = await generateText(prompt);
    console.log('OpenAI response received');

    return { raw_suggestions: text };
  } catch (error) {
    console.error('Error generating travel suggestions:', error.message);
    return { error: error.message || 'Could not generate suggestions' };
  }
}

module.exports = { generateTravelSuggestions };
