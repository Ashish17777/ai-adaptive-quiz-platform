let pdfParse = require('pdf-parse');
const { callGeminiVision } = require('./geminiClient');

// Compatibility wrapper for mehmet-kozan's newer OOP-based pdf-parse library
if (pdfParse && typeof pdfParse !== 'function' && pdfParse.PDFParse) {
  const PDFParseClass = pdfParse.PDFParse;
  pdfParse = async (buffer) => {
    const parser = new PDFParseClass({ data: buffer });
    const textResult = await parser.getText();
    return {
      text: textResult.text || '',
      numpages: textResult.pages ? textResult.pages.length : 1
    };
  };
}

const axios = require('axios');

/**
 * Extract raw text and key keywords from a PDF notes buffer.
 */
async function extractTextFromPDF(pdfBuffer) {
  try {
    const data = await pdfParse(pdfBuffer);
    const text = data.text || '';
    
    // Simple rule-based keyword extractor
    const keywords = extractKeywords(text);

    return {
      text: text.substring(0, 5000), // Cap size to avoid LLM token overflows
      keywords,
      pageCount: data.numpages || 1
    };
  } catch (err) {
    console.warn('[AIService] pdf-parse failed, falling back to buffer-to-string extraction. Error:', err.message);
    const rawText = pdfBuffer.toString('utf8').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    const cleanText = rawText.substring(0, 2000);
    return {
      text: cleanText,
      keywords: extractKeywords(cleanText),
      pageCount: 1
    };
  }
}

/**
 * Extract keywords from filename and metadata for images.
 * In LLM mode, sends the image to a vision model (Gemini 1.5 Flash/OpenAI GPT-4o).
 */
async function extractContextFromImage(imageBuffer, filename) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('AI Service Unavailable: API key is not configured. Please verify your environment settings.');
  }

  try {
    const base64Image = imageBuffer.toString('base64');
    const prompt = "Analyze this educational diagram, graph, or chart. Identify the main subject/topic, standard terms shown, and describe what the graphic represents in 2 sentences. Return the result in JSON format: {\"topic\": \"math/science/etc\", \"description\": \"...\"}";
    
    const resText = await callGeminiVision(prompt, base64Image, 'image/png', { jsonOutput: true });
    const parsed = JSON.parse(resText);
    if (parsed.topic) {
      return {
        topic: parsed.topic.toLowerCase(),
        description: parsed.description,
        keywords: [parsed.topic, ...extractKeywords(parsed.description)]
      };
    }
  } catch (e) {
    console.error('[AIService] Gemini Vision API failed. Error:', e.message);
    throw new Error('AI Service Unavailable: The diagram analysis engine is temporarily unreachable. Please try again after some time.');
  }

  throw new Error('AI Service Unavailable: The diagram analysis engine is temporarily unreachable. Please try again after some time.');
}

/**
 * Helper to pull high-value nouns / topic words from a text string
 */
function extractKeywords(text) {
  const stopWords = new Set([
    'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'cant', 'cannot',
    'could', 'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during', 'each',
    'few', 'for', 'from', 'further', 'had', 'hadnt', 'has', 'hasnt', 'have', 'havent', 'having', 'he', 'hed',
    'hell', 'hes', 'her', 'here', 'heres', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'hows', 'i',
    'id', 'ill', 'im', 'ive', 'if', 'in', 'into', 'is', 'isnt', 'it', 'its', 'itself', 'lets', 'me', 'more',
    'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
    'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shant', 'she', 'shed', 'shell',
    'shes', 'should', 'shouldnt', 'so', 'some', 'such', 'than', 'that', 'thats', 'the', 'their', 'theirs',
    'them', 'themselves', 'then', 'there', 'theres', 'these', 'they', 'theyd', 'theyll', 'theyre', 'theyve',
    'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasnt', 'we', 'wed',
    'well', 'were', 'weve', 'werent', 'what', 'whats', 'when', 'whens', 'where', 'wheres', 'which', 'while',
    'who', 'whos', 'whom', 'why', 'whys', 'with', 'wont', 'would', 'wouldnt', 'you', 'youd', 'youll', 'youre',
    'youve', 'your', 'yours', 'yourself', 'yourselves', 'chapter', 'lecture', 'notes', 'study', 'guide', 'class'
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  // Count word frequencies
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  // Return top 10 keywords by frequency
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(entry => entry[0]);
}

module.exports = { extractTextFromPDF, extractContextFromImage };
