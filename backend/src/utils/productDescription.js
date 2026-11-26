// Bare rules left by the old Easy Accordion import, between normal HTML elements.
const accordionRule = /#sp-ea-\d+(?:\s+\.spcollapsing|\.sp-easy-accordion[.\w\s&;>\-]*)\s*\{[^{}<>]*\}/g;

function cleanProductDescription(html) {
  if (!html) return html;
  const content = html.replace(accordionRule, '');
  const start = content.search(/\{\s*"@context"\s*:\s*"https?:\/\/schema\.org\/?"/);
  if (start < 0) return content;
  try {
    const schema = JSON.parse(content.slice(start));
    if (schema['@type'] === 'FAQPage' && /^sp-ea-schema-/.test(schema['@id']))
      return content.slice(0,start);
  } catch {
    // Keep ordinary text when the suffix is not a complete plugin payload.
  }
  return content;
}

module.exports = { cleanProductDescription };
