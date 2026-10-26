const { generateText } = require('./ai');
const { locationContext, CONCRETE_RULES } = require('./tripContext');

const MAX_ITEMS = 15;

async function generateItinerary(trip, preferences) {
  const start = new Date(trip.startDate);
  const end = trip.endDate ? new Date(trip.endDate) : null;
  const existing = (trip.itinerary || []).map((i) => i.stop).filter(Boolean);

  const prompt = `You are a local travel expert planning a realistic day-by-day itinerary.

Trip: ${trip.name}
Origin: ${trip.origin?.address || 'Unknown'}
${locationContext(trip)}
Start: ${start.toISOString()}
End: ${end ? end.toISOString() : 'not set (assume a short trip of 2-3 days)'}
Already planned stops (do not duplicate): ${existing.join('; ') || 'none'}
${trip.travelSuggestions?.raw_suggestions ? `Earlier travel suggestions:\n${trip.travelSuggestions.raw_suggestions}\n` : ''}${preferences ? `Group preferences: ${preferences}\n` : ''}
${CONCRETE_RULES}

Return ONLY a JSON object: {"items":[{"stop":string,"time":ISO 8601 datetime within the trip dates,"transport":string,"notes":string}]}
- "stop": the exact venue name plus neighbourhood, e.g. "Borough Market, Southwark".
- "transport": how to get there from the previous stop or the accommodation, with duration, e.g. "Walk 12 min" or "Jubilee line, London Bridge (8 min)".
- "notes": one or two short sentences with opening hours, price, booking advice or what to order.
Use at most ${MAX_ITEMS} items in chronological order, with realistic timings (meals at meal times, travel time between stops, no overpacked days).`;

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
