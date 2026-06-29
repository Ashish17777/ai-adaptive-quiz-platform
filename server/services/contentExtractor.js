let pdfParse = require('pdf-parse');

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
  const nameLower = (filename || 'image.png').toLowerCase();
  
  // 1. LLM Vision Mode: Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const base64Image = imageBuffer.toString('base64');
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [
              { text: "Analyze this educational diagram, graph, or chart. Identify the main subject/topic, standard terms shown, and describe what the graphic represents in 2 sentences. Return the result in JSON format: {\"topic\": \"math/science/etc\", \"description\": \"...\"}" },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        }
      );
      
      const resText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(resText);
      if (parsed.topic) {
        return {
          topic: parsed.topic.toLowerCase(),
          description: parsed.description,
          keywords: [parsed.topic, ...extractKeywords(parsed.description)]
        };
      }
    } catch (e) {
      console.warn('[AIService] Gemini Vision API failed. Falling back. Error:', e.message);
    }
  }

  // 2. Fallback: Parse keywords from filename
  console.log(`[AIService] Running rule-based image context extraction for filename "${filename}"`);
  
  let topic = 'general';
  let description = 'An educational chart or diagram.';
  const keywords = [];

  // Match common educational keywords in filename
  if (nameLower.includes('algebra') || nameLower.includes('equation')) {
    topic = 'algebra';
    description = 'An algebraic equation graph or function diagram.';
  } else if (nameLower.includes('probability') || nameLower.includes('venn') || nameLower.includes('dice') || nameLower.includes('coin')) {
    topic = 'probability';
    description = 'A probability distribution chart or Venn diagram.';
  } else if (nameLower.includes('physics') || nameLower.includes('motion') || nameLower.includes('force')) {
    topic = 'physics';
    description = 'A physics vector force or kinematics diagram.';
  } else if (nameLower.includes('chemistry') || nameLower.includes('molecule') || nameLower.includes('atom') || nameLower.includes('periodic')) {
    topic = 'chemistry';
    description = 'A molecular structure diagram or periodic table chart.';
  } else if (nameLower.includes('geometry') || nameLower.includes('triangle') || nameLower.includes('circle')) {
    topic = 'geometry';
    description = 'A geometric shape showing angles and lengths.';
  }

  keywords.push(topic);
  const words = nameLower.split(/[^a-zA-Z]/).filter(w => w.length > 3 && w !== 'image' && w !== 'diagram' && w !== 'graph' && w !== 'png' && w !== 'jpg' && w !== 'jpeg');
  keywords.push(...words);

  return {
    topic,
    description,
    keywords: [...new Set(keywords)]
  };
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
