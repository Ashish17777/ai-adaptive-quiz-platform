/**
 * Document Parser Utility
 * Parses CSV, JSON, and TXT files containing student records.
 * Modular structure allowing future expansion for Excel (.xlsx) and PDF files.
 */

function parseCSV(contentString) {
  const lines = contentString
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  // Determine headers
  const firstLine = lines[0].toLowerCase();
  let startIndex = 0;
  let nameIdx = 0;
  let emailIdx = 1;
  let passIdx = 2;

  // Check if first line is header
  if (firstLine.includes('email') || firstLine.includes('name')) {
    startIndex = 1;
    const headers = firstLine.split(/,|\t/).map((h) => h.trim().replace(/^["']|["']$/g, ''));
    nameIdx = headers.findIndex((h) => h.includes('name'));
    emailIdx = headers.findIndex((h) => h.includes('email'));
    passIdx = headers.findIndex((h) => h.includes('pass'));

    if (nameIdx === -1) nameIdx = 0;
    if (emailIdx === -1) emailIdx = 1;
  }

  const students = [];

  for (let i = startIndex; i < lines.length; i++) {
    const row = lines[i].split(/,|\t/).map((val) => val.trim().replace(/^["']|["']$/g, ''));
    const name = row[nameIdx] || '';
    const email = row[emailIdx] || '';
    const password = passIdx !== -1 && row[passIdx] ? row[passIdx] : undefined;

    if (email && email.includes('@')) {
      students.push({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password,
      });
    }
  }

  return students;
}

function parseJSON(contentString) {
  try {
    const data = JSON.parse(contentString);
    const list = Array.isArray(data) ? data : data.students || [];

    return list
      .filter((item) => item && item.email && item.email.includes('@'))
      .map((item) => ({
        name: item.name || item.fullName || item.email.split('@')[0],
        email: String(item.email).trim().toLowerCase(),
        password: item.password ? String(item.password).trim() : undefined,
      }));
  } catch (err) {
    throw new Error(`Invalid JSON format: ${err.message}`);
  }
}

function parseDocument(buffer, filename, mimetype) {
  const contentString = buffer.toString('utf-8');
  const ext = (filename.split('.').pop() || '').toLowerCase();

  if (ext === 'json' || mimetype.includes('json')) {
    return parseJSON(contentString);
  }

  // Default to CSV / TXT parsing
  return parseCSV(contentString);
}

module.exports = {
  parseCSV,
  parseJSON,
  parseDocument,
};
