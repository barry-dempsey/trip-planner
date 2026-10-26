const { generateText } = require('./ai');
const { locationContext, CONCRETE_RULES } = require('./tripContext');

async function generateTravelSuggestions(trip) {
  try {
    console.log('Starting travel suggestions generation...');
    const prompt = `You are a local travel expert. Generate concrete travel suggestions for this trip:

Trip Name: ${trip.name}
Origin: ${trip.origin?.address || 'Unknown'}
${locationContext(trip)}
Start Date: ${new Date(trip.startDate).toLocaleDateString()}

${CONCRETE_RULES}

Structure the answer with these headings (use "#### " before each heading):
#### Getting there
Best 2-3 options with named operators/airports/stations, typical cost and duration, and a booking tip.
#### Getting around from your accommodation
Nearest stations/stops, lines to use, and typical fares or passes.
#### Top things to do nearby
5-7 named places within walking or a short transit ride, each with neighbourhood, travel time from the accommodation and one practical tip.
#### Where to eat nearby
3-5 named restaurants, cafes or markets with the dish to order and rough price.
Keep every bullet specific and short.`;

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
