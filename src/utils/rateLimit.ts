export const RATE_LIMIT_SPECS = {
  free: { requestsPerMinute: 60, burstLimit: 10, burstWindow: 10, daily: 5000 },
  pro: {
    requestsPerMinute: 300,
    burstLimit: 30,
    burstWindow: 10,
    daily: 100000,
  },
  agency: {
    requestsPerMinute: 1000,
    burstLimit: 100,
    burstWindow: 10,
    daily: 0,
  }, // 0 means unlimited
};

export const getRateLimit = (plan: "free" | "pro" | "agency") => {
  return RATE_LIMIT_SPECS[plan];
};

export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  plan: "free" | "pro" | "agency",
): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  reset: number;
}> {
  const spec = getRateLimit(plan);
  const now = Date.now();
  const minuteStart = Math.floor(now / 60000) * 60000;
  const burstStart =
    Math.floor(now / (spec.burstWindow * 1000)) * (spec.burstWindow * 1000);
  const dayStart = Math.floor(now / 86400000) * 86400000;

  const minKey = `rl:min:${key}:${minuteStart}`;
  const burstKey = `rl:brst:${key}:${burstStart}`;
  const dayKey = `rl:day:${key}:${dayStart}`;

  // Fetch all keys at once
  const [minStr, burstStr, dayStr] = await Promise.all([
    kv.get(minKey),
    kv.get(burstKey),
    spec.daily > 0 ? kv.get(dayKey) : Promise.resolve("0"),
  ]);

  const minCount = minStr ? parseInt(minStr, 10) : 0;
  const burstCount = burstStr ? parseInt(burstStr, 10) : 0;
  const dayCount = dayStr ? parseInt(dayStr, 10) : 0;

  let rejectReason = "";
  let limit = spec.requestsPerMinute;
  let remaining = spec.requestsPerMinute - minCount;
  let reset = minuteStart + 60000;

  if (spec.daily > 0 && dayCount >= spec.daily) {
    rejectReason = "daily";
    limit = spec.daily;
    remaining = 0;
    reset = dayStart + 86400000;
  } else if (minCount >= spec.requestsPerMinute) {
    rejectReason = "minute";
    limit = spec.requestsPerMinute;
    remaining = 0;
    reset = minuteStart + 60000;
  } else if (burstCount >= spec.burstLimit) {
    rejectReason = "burst";
    limit = spec.burstLimit;
    remaining = 0;
    reset = burstStart + spec.burstWindow * 1000;
  }

  if (rejectReason !== "") {
    return { allowed: false, remaining, limit, reset };
  }

  // Best effort KV updates using waitUntil from caller
  // We'll return an object indicating we need to increment these counts.
  return {
    allowed: true,
    remaining: spec.requestsPerMinute - minCount - 1,
    limit: spec.requestsPerMinute,
    reset: minuteStart + 60000,
  };
}

export function incrementRateLimits(
  kv: KVNamespace,
  key: string,
  plan: "free" | "pro" | "agency",
  now: number = Date.now(),
): Promise<any> {
  const spec = getRateLimit(plan);
  const minuteStart = Math.floor(now / 60000) * 60000;
  const burstStart =
    Math.floor(now / (spec.burstWindow * 1000)) * (spec.burstWindow * 1000);
  const dayStart = Math.floor(now / 86400000) * 86400000;

  const minKey = `rl:min:${key}:${minuteStart}`;
  const burstKey = `rl:brst:${key}:${burstStart}`;
  const dayKey = `rl:day:${key}:${dayStart}`;

  const inc = async (k: string, ttl: number) => {
    const val = await kv.get(k);
    const count = val ? parseInt(val, 10) + 1 : 1;
    await kv.put(k, count.toString(), { expirationTtl: ttl });
  };

  const tasks = [inc(minKey, 120), inc(burstKey, spec.burstWindow * 2)];

  if (spec.daily > 0) {
    tasks.push(inc(dayKey, 86400 + 3600)); // 25 hours
  }

  return Promise.allSettled(tasks);
}
