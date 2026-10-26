// Shared context + rules so AI output is specific to where the group is staying
function describeStay(trip) {
  const stay = trip.accommodation || {};
  const parts = [stay.name, stay.address].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function locationContext(trip) {
  const stay = describeStay(trip);
  const dest = trip.destination?.address || 'Unknown';
  const coords =
    trip.destination?.lat != null && trip.destination?.lng != null
      ? ` (coordinates ${trip.destination.lat}, ${trip.destination.lng})`
      : '';
  return [
    `Destination: ${dest}${coords}`,
    stay
      ? `Staying at: ${stay} - treat this as the home base and centre everything around it.`
      : `Staying at: not specified - centre everything on the central area of the destination.`,
  ].join('\n');
}

const CONCRETE_RULES = `Rules for being concrete:
- Name real, specific, well-known places (exact venue, restaurant, museum, park, market, station or street names). Never write generic items like "local restaurant", "explore the city" or "visit a museum".
- Only include places you are confident exist and are still open. If unsure, choose a more famous alternative. Do not invent names or addresses.
- Stay close to where the group is staying. Give the neighbourhood, approximate walking time or the exact transit line/stop from the accommodation, and group nearby places into the same day.
- Include practical details where known: typical opening hours, ticket price range, whether booking ahead is needed, and a best-time-to-go tip.
- For meals, name a specific restaurant or market plus a signature dish to order.
- Schedule each stop inside its opening hours, and do not list the accommodation itself as a stop.`;

module.exports = { describeStay, locationContext, CONCRETE_RULES };
