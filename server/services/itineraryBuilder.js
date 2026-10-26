const { generateText } = require('./ai');

const MAX_ITEMS = 15;

async function generateItinerary(trip, preferences) {
  const start = new Date(trip.startDate);
  const end = trip.endDate ? new Date(trip.endDate) : null;
  const existing = (trip.itinerary || []).map((i) => i.stop).filter(Boolean);

  const prompt = `You are a travel planner. Build an itinerary for this trip.

Trip: ${trip.name}
Origin: ${trip.origin?.address || 'Unknown'}
Destination: ${trip.destination?.address || 'Unknown'}
Start: ${start.toISOString()}
End: ${end ? end.toISOString() : 'not set (assume a short trip of 2-3 days)'}
Already planned stops (do not duplicate): ${existing.join('; ') || 'none'}
${trip.travelSuggestions?.raw_suggestions ? `Earlier travel suggestions:\n${trip.travelSuggestions.raw_suggestions}\n` : ''}${preferences ? `Group preferences: ${preferences}\n` : ''}
Return ONLY a JSON object: {"items":[{"stop":string,"time":ISO 8601 datetime within the trip dates,"transport":string,"notes":string}]}
Use at most ${MAX_ITEMS} items in chronological order. Keep notes to one short sentence.`;

  const text = await generateText(prompt, { json: true });
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.items)) throw new Error('AI returned an unexpected format');

  return parsed.items
    .filter((i) => typeof i.stop === 'string' && i.stop.trim())
    .slice(0, MAX_ITEMS)
    .map((i) => {
      const time = new Date(i.time);
      return {
        stop: i.stop.trim(),
        time: isNaN(time) ? start : time,
        transport: typeof i.transport === 'string' ? i.transport : '',
        notes: typeof i.notes === 'string' ? i.notes : '',
      };
    });
}

module.exports = { generateItinerary };
