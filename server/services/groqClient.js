const dns = require('dns');

// Prioritize IPv4 on Node to prevent connection timeouts on Windows
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Call Groq API for text or JSON generation using openai/gpt-oss-120b.
 * @param {string} prompt - Prompt or instruction
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.jsonOutput=false] - Request JSON object output
 * @param {number} [options.temperature=0.7] - Model temperature
 * @returns {Promise<string>} The generated output string
 */
async function callGroq(prompt, options = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set in server environment');
  }

  const messages = [];

  if (options.jsonOutput) {
    messages.push({
      role: 'system',
      content: 'You are an expert AI assessment and quiz generator. You must respond strictly with a valid JSON object matching the requested schema. Do not output markdown code blocks (```json) or outside commentary.'
    });
  }

  messages.push({
    role: 'user',
    content: prompt
  });

  const body = {
    model: GROQ_MODEL,
    messages,
    temperature: options.temperature !== undefined ? options.temperature : 0.7
  };

  if (options.jsonOutput) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Groq API responded with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = errorData;
    throw err;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Empty response received from Groq API');
  }

  return text;
}

module.exports = {
  callGroq,
  callAI: callGroq,
  callGemini: callGroq, // Seamless fallback alias
  GROQ_MODEL
};
