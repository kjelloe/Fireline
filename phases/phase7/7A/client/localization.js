// client/localization.js — Localization & i18n (7A)
// Pure string-table loader and interpolator. No external libraries.
// Locale files live in data/locales/{locale}.json.

const _registry = {};   // { locale: { key: string } }
let _active = 'en';

/** Register a locale dictionary (used in tests and at boot). */
export function registerLocale(locale, dict) {
  if (typeof locale !== 'string' || !locale) throw new Error('locale must be a non-empty string');
  if (!dict || typeof dict !== 'object' || Array.isArray(dict)) throw new Error('dict must be a plain object');
  _registry[locale] = { ...(dict) };
}

/** Switch the active locale. Falls back to 'en' if locale not registered. */
export function setLocale(locale) {
  _active = _registry[locale] ? locale : 'en';
}

/** Return the currently active locale identifier. */
export function getLocale() {
  return _active;
}

/**
 * Translate a key with optional interpolation params.
 * Pluralization: if params.count === 1 and key + '_one' exists, use that form.
 * Interpolation: replaces {placeholder} tokens with params values.
 * Falls back to 'en', then to the raw key if nothing found.
 */
export function t(key, params = {}) {
  const dict = _registry[_active] || {};
  const fallback = _registry['en'] || {};

  // Pluralization: prefer key_one when count === 1
  let resolved = key;
  if (params.count === 1) {
    const oneKey = key + '_one';
    if (dict[oneKey] !== undefined) resolved = oneKey;
    else if (fallback[oneKey] !== undefined) resolved = oneKey;
  }

  const template = dict[resolved] ?? fallback[resolved] ?? resolved;
  return interpolate(template, params);
}

/** Replace {token} placeholders in a template string. */
export function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
}

/**
 * Load a locale JSON file from the filesystem (Node.js / server-side use).
 * In browser contexts, callers should fetch and pass the dict to registerLocale.
 */
export async function loadLocale(locale, readFileFn) {
  if (typeof readFileFn !== 'function') throw new Error('readFileFn required');
  const raw = await readFileFn(locale);
  const dict = JSON.parse(raw);
  registerLocale(locale, dict);
  return dict;
}
