import { useCallback, useMemo, useState } from 'react';

/*
  Form validation.

  A rule is a function (value, allValues) => '' when fine, or an error message.
  Rules for a field run in order and the first message wins.

    const v = useValidation({ email: [required('Enter your email'), email()] }, form);
    <Field label="Email" value={form.email} onChange={…} {...v.bind('email')} />
    const submit = (e) => { e.preventDefault(); if (!v.check()) return; … };

  A field is checked when the shopper leaves it, and from then on while they type,
  so a mistake is flagged once and clears the moment it is fixed.
*/

const text = (value) => String(value ?? '').trim();
const digits = (value) => String(value ?? '').replace(/\D/g, '');

export const required = (message = 'This field is required') => (value) => (text(value) ? '' : message);

export const email = (message = 'Enter a valid email address, like name@example.com') => (value) =>
  !text(value) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text(value)) ? '' : message;

export const phone = (message = 'Enter a 10-digit mobile number') => (value) =>
  !text(value) || /^[6-9]\d{9}$/.test(digits(value)) ? '' : message;

export const pincode = (message = 'Enter a 6-digit PIN code') => (value) =>
  !text(value) || /^[1-9]\d{5}$/.test(text(value)) ? '' : message;

export const minLength = (length, message) => (value) =>
  !text(value) || text(value).length >= length ? '' : message || `Use at least ${length} characters`;

export const maxLength = (length, message) => (value) =>
  text(value).length <= length ? '' : message || `Keep it under ${length} characters`;

export const password = () => (value) => {
  const v = String(value ?? '');
  if (!v) return '';
  if (v.length < 8) return 'Use at least 8 characters';
  if (!/[A-Za-z]/.test(v)) return 'Add at least one letter';
  if (!/\d/.test(v)) return 'Add at least one number';
  return '';
};

export const matches = (otherField, message = 'The two entries do not match') => (value, all) =>
  String(value ?? '') === String(all[otherField] ?? '') ? '' : message;

export const number = ({ min, max, whole, message } = {}) => (value) => {
  if (text(value) === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return message || 'Enter a number';
  if (whole && !Number.isInteger(n)) return message || 'Enter a whole number';
  if (min !== undefined && n < min) return message || `Must be ${min} or more`;
  if (max !== undefined && n > max) return message || `Must be ${max} or less`;
  return '';
};

/** Keeps only digits, up to `max` — for phone and PIN code boxes. */
export const onlyDigits = (value, max) => digits(value).slice(0, max);

export function useValidation(rules, values) {
  const [touched, setTouched] = useState({});
  // Messages sent back by the server, kept only until that field is edited.
  const [server, setServer] = useState({});

  const test = useCallback(
    (name) => {
      for (const rule of rules[name] || []) {
        const message = rule(values[name], values);
        if (message) return message;
      }
      return '';
    },
    [rules, values]
  );

  const errors = useMemo(() => {
    const found = {};
    for (const name of Object.keys(rules)) {
      if (touched[name]) {
        const message = test(name);
        if (message) found[name] = message;
      }
    }
    for (const [name, entry] of Object.entries(server)) {
      if (!found[name] && entry && String(values[name] ?? '') === entry.value) found[name] = entry.message;
    }
    return found;
  }, [rules, touched, server, values, test]);

  return {
    errors,
    /** Props for a <Field>: its name, current error, and "check me when I lose focus". */
    bind: (name) => ({ name, error: errors[name], onBlur: () => setTouched((t) => (t[name] ? t : { ...t, [name]: true })) }),
    /** Validate everything (on submit). Focuses the first field that needs attention. */
    check: () => {
      setServer({});
      setTouched(Object.fromEntries(Object.keys(rules).map((name) => [name, true])));
      const firstBad = Object.keys(rules).find((name) => test(name));
      if (!firstBad) return true;
      requestAnimationFrame(() => {
        const field = document.querySelector(`[name="${firstBad}"]`);
        field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        field?.focus({ preventScroll: true });
      });
      return false;
    },
    /** Show field messages returned by the API (e.g. "email already registered"). */
    setServerErrors: (fields = {}) =>
      setServer(Object.fromEntries(Object.entries(fields).map(([name, message]) => [name, { message, value: String(values[name] ?? '') }]))),
    reset: () => {
      setTouched({});
      setServer({});
    },
  };
}
