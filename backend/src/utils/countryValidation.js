const COUNTRY_VALIDATORS = {
  India: {
    validatePhone: (digits) => digits.length === 10 && /^[6-9]\d{9}$/.test(digits),
    phoneError: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9',
    validatePostal: (val) => /^[1-9]\d{5}$/.test(String(val || '').trim()),
    postalError: 'Enter a valid 6-digit Indian PIN code',
  },
  'United States': {
    validatePhone: (digits) => digits.length === 10 && /^[2-9]\d{9}$/.test(digits),
    phoneError: 'Enter a valid 10-digit US phone number',
    validatePostal: (val) => /^\d{5}(-\d{4})?$/.test(String(val || '').trim()),
    postalError: 'Enter a valid 5-digit ZIP code',
  },
  'United Kingdom': {
    validatePhone: (digits) => (digits.length === 10 || digits.length === 11) && (/^7\d{9}$/.test(digits) || /^[1-9]\d{9,10}$/.test(digits)),
    phoneError: 'Enter a valid 10 or 11-digit UK phone number',
    validatePostal: (val) => /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/i.test(String(val || '').trim()),
    postalError: 'Enter a valid UK postcode',
  },
  'United Arab Emirates': {
    validatePhone: (digits) => digits.length === 9 && /^5\d{8}$/.test(digits),
    phoneError: 'Enter a valid 9-digit UAE mobile number starting with 5',
    validatePostal: (val) => !val || /^[A-Za-z0-9\s-]{2,10}$/.test(String(val || '').trim()),
    postalError: 'Enter a valid postal code or PO Box',
  },
  Singapore: {
    validatePhone: (digits) => digits.length === 8 && /^[89]\d{7}$/.test(digits),
    phoneError: 'Enter a valid 8-digit Singapore phone number starting with 8 or 9',
    validatePostal: (val) => /^\d{6}$/.test(String(val || '').trim()),
    postalError: 'Enter a valid 6-digit Singapore postal code',
  },
  Malaysia: {
    validatePhone: (digits) => (digits.length === 9 || digits.length === 10) && /^1\d{8,9}$/.test(digits),
    phoneError: 'Enter a valid 9 or 10-digit Malaysia mobile number',
    validatePostal: (val) => /^\d{5}$/.test(String(val || '').trim()),
    postalError: 'Enter a valid 5-digit Malaysia postcode',
  },
  Canada: {
    validatePhone: (digits) => digits.length === 10 && /^[2-9]\d{9}$/.test(digits),
    phoneError: 'Enter a valid 10-digit Canadian phone number',
    validatePostal: (val) => /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(String(val || '').trim()),
    postalError: 'Enter a valid Canadian postal code',
  },
  Australia: {
    validatePhone: (digits) => digits.length === 9 && /^4\d{8}$/.test(digits),
    phoneError: 'Enter a valid 9-digit Australian mobile number starting with 4',
    validatePostal: (val) => /^\d{4}$/.test(String(val || '').trim()),
    postalError: 'Enter a valid 4-digit Australian postcode',
  },
  'Saudi Arabia': {
    validatePhone: (digits) => digits.length === 9 && /^5\d{8}$/.test(digits),
    phoneError: 'Enter a valid 9-digit Saudi mobile number starting with 5',
    validatePostal: (val) => /^\d{5}$/.test(String(val || '').trim()),
    postalError: 'Enter a valid 5-digit Saudi postal code',
  },
  Germany: {
    validatePhone: (digits) => (digits.length >= 10 && digits.length <= 11) && /^[1-9]\d{9,10}$/.test(digits),
    phoneError: 'Enter a valid 10 or 11-digit German phone number',
    validatePostal: (val) => /^\d{5}$/.test(String(val || '').trim()),
    postalError: 'Enter a valid 5-digit German postal code',
  },
  France: {
    validatePhone: (digits) => digits.length === 9 && /^[67]\d{8}$/.test(digits),
    phoneError: 'Enter a valid 9-digit French mobile number starting with 6 or 7',
    validatePostal: (val) => /^\d{5}$/.test(String(val || '').trim()),
    postalError: 'Enter a valid 5-digit French postal code',
  },
};

function getValidator(country) {
  if (!country) return COUNTRY_VALIDATORS.India;
  const match = Object.keys(COUNTRY_VALIDATORS).find(
    (k) => k.toLowerCase() === String(country).toLowerCase()
  );
  if (match) return COUNTRY_VALIDATORS[match];

  // General international fallback
  return {
    validatePhone: (digits) => digits.length >= 7 && digits.length <= 15,
    phoneError: 'Enter a valid international phone number (7 to 15 digits)',
    validatePostal: (val) => /^[A-Za-z0-9\s-]{3,12}$/.test(String(val || '').trim()),
    postalError: 'Enter a valid postal / ZIP code (3 to 12 characters)',
  };
}

module.exports = { COUNTRY_VALIDATORS, getValidator };
