/**
 * Vendor names out of vendor-written help text.
 *
 * The parameter fields are generated from each model's own JSON schema, and the
 * vendor wrote those descriptions for their own developers — so they name their
 * products ("a cloned voice ID from suno-voice-clone", "requires model V5"),
 * which tells our customers who supplies us and means nothing to them anyway.
 *
 * This rewrites the text rather than hiding it: the help is genuinely useful,
 * it just cannot carry a supplier's name onto the page.
 */
const VENDOR_WORDS = [
  'suno', 'muapi', 'seedance', 'seedvr2?', 'omnihuman', 'topaz', 'nano[- ]?banana',
  'kling', 'hailuo', 'minimax', 'elevenlabs', 'eleven labs', 'midjourney',
  'ideogram', 'bytedance', 'stability ?ai', 'leonardo ?ai', 'runway', 'luma',
  'veo', 'sora', 'pika', 'gemini', 'openai', 'infinite ?talk', 'flux',
];

// Longest first so "suno-voice-clone" is replaced before "suno".
const PATTERN = new RegExp(
  '\\b(?:' + VENDOR_WORDS.join('|') + ')(?:[-_.][a-z0-9]+)*\\b',
  'gi',
);

export function sanitiseHelp(text) {
  if (!text) return text;
  let out = String(text).replace(PATTERN, 'this tool');
  // Version numbers left dangling once the product name is gone.
  out = out.replace(/\brequires model V[\d_.]+\b\.?/gi, '');
  out = out.replace(/\bmodel V[\d_.]+\b/gi, 'a newer version');
  // Tidy the seams the substitution can leave behind.
  out = out.replace(/\bthis tool (?:this tool\b\s*)+/gi, 'this tool ');
  return out.replace(/\s{2,}/g, ' ').trim();
}
