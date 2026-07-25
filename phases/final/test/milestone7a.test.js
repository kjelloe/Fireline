// test/milestone7a.test.js — Milestone 7A: Localization & i18n
import { test } from 'node:test';
import assert from 'node:assert';
import {
  registerLocale, setLocale, getLocale, t, interpolate, loadLocale
} from '../client/localization.js';

// Seed test dictionaries
registerLocale('en', {
  unit_destroyed: 'Unit destroyed',
  units_remaining: '{count} units remaining',
  units_remaining_one: '1 unit remaining',
  victory: 'Victory!',
  welcome: 'Welcome, {name}!'
});
registerLocale('no', {
  unit_destroyed: 'Enhet ødelagt',
  units_remaining: '{count} enheter gjenstår',
  units_remaining_one: '1 enhet gjenstår',
  victory: 'Seier!',
  welcome: 'Velkommen, {name}!'
});

test('7A getLocale returns active locale', () => {
  setLocale('en');
  assert.strictEqual(getLocale(), 'en');
});

test('7A setLocale switches active locale', () => {
  setLocale('no');
  assert.strictEqual(getLocale(), 'no');
  setLocale('en');
});

test('7A setLocale falls back to en for unknown locale', () => {
  setLocale('zz');
  assert.strictEqual(getLocale(), 'en');
});

test('7A t returns translated string', () => {
  setLocale('no');
  assert.strictEqual(t('victory'), 'Seier!');
  setLocale('en');
});

test('7A t falls back to en for missing key in active locale', () => {
  registerLocale('partial', { victory: 'Victoire!' });
  setLocale('partial');
  assert.strictEqual(t('unit_destroyed'), 'Unit destroyed'); // en fallback
  setLocale('en');
});

test('7A t returns raw key when missing from all locales', () => {
  setLocale('en');
  assert.strictEqual(t('nonexistent_key'), 'nonexistent_key');
});

test('7A t interpolates {token} placeholders', () => {
  setLocale('en');
  assert.strictEqual(t('welcome', { name: 'Kjell' }), 'Welcome, Kjell!');
});

test('7A t uses plural _one form when count === 1', () => {
  setLocale('en');
  assert.strictEqual(t('units_remaining', { count: 1 }), '1 unit remaining');
  assert.strictEqual(t('units_remaining', { count: 5 }), '5 units remaining');
});

test('7A t uses plural _one form in non-english locale', () => {
  setLocale('no');
  assert.strictEqual(t('units_remaining', { count: 1 }), '1 enhet gjenstår');
  assert.strictEqual(t('units_remaining', { count: 3 }), '3 enheter gjenstår');
  setLocale('en');
});

test('7A interpolate leaves unknown tokens intact', () => {
  assert.strictEqual(interpolate('Hello {name}!', {}), 'Hello {name}!');
});

test('7A registerLocale rejects invalid inputs', () => {
  assert.throws(() => registerLocale('', {}), /non-empty string/);
  assert.throws(() => registerLocale('en', null), /plain object/);
  assert.throws(() => registerLocale('en', []), /plain object/);
});

test('7A loadLocale reads and registers a locale via readFileFn', async () => {
  const fakeRead = async (locale) => JSON.stringify({ hello: 'Hei' });
  await loadLocale('fake', fakeRead);
  setLocale('fake');
  assert.strictEqual(t('hello'), 'Hei');
  setLocale('en');
});
