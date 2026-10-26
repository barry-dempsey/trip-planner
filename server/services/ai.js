const OpenAI = require('openai');

let client;

async function generateText(prompt, { json = false } = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  client = client || new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    ...(json && { response_format: { type: 'json_object' } }),
  });
  return response.choices[0].message.content;
}

module.exports = { generateText };
