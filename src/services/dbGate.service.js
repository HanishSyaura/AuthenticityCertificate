let disabledUntil = 0;
let failureCount = 0;
let firstFailureAt = 0;

function now() {
  return Date.now();
}

function shouldUseDb() {
  return now() >= disabledUntil;
}

function getGateConfig() {
  const thresholdRaw = process.env.DB_GATE_FAILURE_THRESHOLD;
  const windowRaw = process.env.DB_GATE_FAILURE_WINDOW_MS;
  const cooldownRaw = process.env.DB_GATE_COOLDOWN_MS;
  const threshold = Number(thresholdRaw);
  const windowMs = Number(windowRaw);
  const cooldownMs = Number(cooldownRaw);
  return {
    threshold: Number.isFinite(threshold) && threshold > 0 ? Math.floor(threshold) : 3,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? Math.floor(windowMs) : 30_000,
    cooldownMs: Number.isFinite(cooldownMs) && cooldownMs > 0 ? Math.floor(cooldownMs) : 10_000
  };
}

function markDbFailure({ cooldownMs, error } = {}) {
  const cfg = getGateConfig();
  const windowMs = cfg.windowMs;
  const threshold = cfg.threshold;
  const cooldownEffective = Number.isFinite(Number(cooldownMs)) && Number(cooldownMs) > 0 ? Number(cooldownMs) : cfg.cooldownMs;

  const t = now();
  if (!firstFailureAt || t - firstFailureAt > windowMs) {
    firstFailureAt = t;
    failureCount = 0;
  }
  failureCount += 1;

  console.error(`[dbGate] DB failure detected (${failureCount}/${threshold}). Error: ${error?.message || error || 'Unknown error'}`);

  if (failureCount < threshold) return;

  const next = t + Math.max(1000, cooldownEffective);
  if (next > disabledUntil) {
    disabledUntil = next;
    console.error(`[dbGate] Circuit breaker TRIPPED. DB disabled until ${new Date(disabledUntil).toISOString()}`);
  }
}

function markDbSuccess() {
  disabledUntil = 0;
  failureCount = 0;
  firstFailureAt = 0;
}

module.exports = {
  shouldUseDb,
  markDbFailure,
  markDbSuccess
};

