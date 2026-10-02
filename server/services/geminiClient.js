const axios = require('axios');
const { callGroq } = require('./groqClient');

const GEMINI_MODEL = 'gemini-3.8-flash';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/**
 * Extract the output text from a Gemini Interactions API response.
 * The SDK exposes `output_text`; for REST we parse from the `steps` array.
 */
function extractOutputText(data) {
  // SDK-style top-level field
  if (data.output_text) return data.output_text;

  // REST: walk the steps array for model_output
  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      if (step.type === 'model_output' && Array.isArray(step.content)) {
        const textPart = step.content.find(c => c.type === 'text');
        if (textPart?.text) return textPart.text;
      }
    }
  }

  // Legacy generateContent format (in case the API still returns it)
  const legacy = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (legacy) return legacy;

  return null;
}

/**
 * Call AI for text generation. Delegates to Groq if configured, otherwise Gemini.
 * @param {string} prompt - The input prompt
 * @param {object} [options] - Optional config
 * @param {boolean} [options.jsonOutput=false] - Request JSON-formatted output
 * @returns {Promise<string>} The output text
 */
async function callGemini(prompt, options = {}) {
  if (process.env.GROQ_API_KEY) {
    return callGroq(prompt, options);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Neither GROQ_API_KEY nor GEMINI_API_KEY is set');

  const body = {
    model: GEMINI_MODEL,
    input: prompt
  };

  if (options.jsonOutput) {
    body.response_format = {
      type: 'text',
      mime_type: 'application/json'
    };
  }

  const response = await axios.post(GEMINI_API_URL, body, {
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  const text = extractOutputText(response.data);
  if (!text) throw new Error('Empty response from Gemini API');
  return text;
}

/**
 * Call Gemini Interactions API with an inline image (vision).
 * @param {string} prompt - The text prompt
 * @param {string} base64Data - Base64-encoded image data
 * @param {string} [mimeType='image/png'] - MIME type of the image
 * @param {object} [options] - Optional config
 * @param {boolean} [options.jsonOutput=false] - Request JSON-formatted output
 * @returns {Promise<string>} The output text
 */
async function callGeminiVision(prompt, base64Data, mimeType = 'image/png', options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const body = {
    model: GEMINI_MODEL,
    input: [
      { type: 'text', text: prompt },
      {
        type: 'image',
        image: {
          image_bytes: base64Data,
          mime_type: mimeType
        }
      }
    ]
  };

  if (options.jsonOutput) {
    body.response_format = {
      type: 'text',
      mime_type: 'application/json'
    };
  }

  const response = await axios.post(GEMINI_API_URL, body, {
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  const text = extractOutputText(response.data);
  if (!text) throw new Error('Empty response from Gemini Vision API');
  return text;
}

module.exports = { callGemini, callGeminiVision, GEMINI_MODEL, extractOutputText };
