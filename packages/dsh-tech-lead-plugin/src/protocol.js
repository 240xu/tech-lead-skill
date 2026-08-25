export function parseJsonString(value, path = 'input') {
  if (typeof value !== 'string') {
    return { ok: false, error: { code: 'BAD_INPUT', path, message: 'expected JSON text string' } };
  }
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    return { ok: false, error: { code: 'BAD_INPUT', path, message: `invalid JSON: ${error.message}` } };
  }
}

export function csv(value) {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function renderEnvelope(value) {
  return JSON.stringify(value, null, 2);
}
