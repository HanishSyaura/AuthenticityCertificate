let disabledUntil = 0;

function now() {
  return Date.now();
}

function shouldUseDb() {
  return now() >= disabledUntil;
}

function markDbFailure({ cooldownMs = 10_000 } = {}) {
  const next = now() + Math.max(1000, Number(cooldownMs) || 10_000);
  if (next > disabledUntil) disabledUntil = next;
}

function markDbSuccess() {
  disabledUntil = 0;
}

module.exports = {
  shouldUseDb,
  markDbFailure,
  markDbSuccess
};

