const dns = require('dns').promises;

let disposableDomainsSet = null;

try {
  const disposableDomains = require('disposable-email-domains');
  disposableDomainsSet = new Set(disposableDomains);
} catch (e) {
  // Fallback list of common disposable email domains if package import varies
  disposableDomainsSet = new Set([
    'tempmail.com', 'guerrillamail.com', 'mailinator.com', '10minutemail.com',
    'trashmail.com', 'sharklasers.com', 'dispostable.com', 'getnada.com',
    'temp-mail.org', 'yopmail.com', 'byom.de', 'fakeinbox.com'
  ]);
}

/**
 * Validates an email address format, blocks disposable domains,
 * and verifies that the domain has active DNS MX records.
 * @param {string} email
 * @returns {Promise<{ isValid: boolean, error?: string }>}
 */
const validateEmailDomain = async (email) => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Invalid email address provided' };
  }

  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { isValid: false, error: 'Invalid email format' };
  }

  const domain = parts[1];

  // 1. Check against disposable domain blacklist
  if (disposableDomainsSet.has(domain)) {
    return {
      isValid: false,
      error: 'Disposable and temporary email addresses are not allowed. Please use a valid email.'
    };
  }

  // 2. Perform DNS MX Record lookup to ensure domain can receive emails
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        isValid: false,
        error: `The domain "@${domain}" does not appear to have valid mail server records.`
      };
    }
  } catch (err) {
    // ENOTFOUND or ENODATA means domain does not exist or has no mail servers
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return {
        isValid: false,
        error: `The email domain "@${domain}" does not exist or has no mail servers.`
      };
    }
    // Network DNS resolution fallback warning (do not hard fail if DNS server is offline locally)
    console.warn(`DNS MX check warning for ${domain}: ${err.message}`);
  }

  return { isValid: true };
};

module.exports = { validateEmailDomain };
