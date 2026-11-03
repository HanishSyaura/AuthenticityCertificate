function getDateParts(input) {
  if (!input) return null;

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function formatDateTimeMY(input) {
  const p = getDateParts(input);
  return p ? `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}` : '';
}

export function formatDateMY(input) {
  if (!input) return '';

  // Preserve date-only values as calendar dates without timezone conversion.
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  const p = getDateParts(input);
  return p ? `${p.year}-${p.month}-${p.day}` : '';
}
