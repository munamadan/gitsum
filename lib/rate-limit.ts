import { kv } from '@vercel/kv';

export async function checkPooledRateLimit(): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const now = Date.now();
  const currentMinute = Math.floor(now / 60000);
  const currentDay = Math.floor(now / 86400000);

  const rpmKey = `gemini:rpm:${currentMinute}`;
  const rpdKey = `gemini:rpd:${currentDay}`;

  const [rpmCount, rpdCount] = await Promise.all([
    kv.incr(rpmKey),
    kv.incr(rpdKey),
  ]);

  if (rpmCount === 1) {
    await kv.expire(rpmKey, 60);
  }
  if (rpdCount === 1) {
    await kv.expire(rpdKey, 86400);
  }

  const RPM_LIMIT = 5;
  const RPD_LIMIT = 20;

  if (rpmCount > RPM_LIMIT || rpdCount > RPD_LIMIT) {
    const resetAt = new Date((currentMinute + 1) * 60000);
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  const remaining = Math.min(
    RPM_LIMIT - rpmCount,
    RPD_LIMIT - rpdCount
  );

  return {
    allowed: true,
    remaining,
    resetAt: new Date((currentDay + 1) * 86400000),
  };
}

export async function getDailyUsage(): Promise<{
  used: number;
  total: number;
  remaining: number;
  resetAt: Date;
}> {
  const now = Date.now();
  const currentDay = Math.floor(now / 86400000);
  const rpdKey = `gemini:rpd:${currentDay}`;

  const rpdCount = (await kv.get(rpdKey)) as number | null;

  const total = 20;
  const used = rpdCount || 0;
  const remaining = Math.max(0, total - used);
  const resetAt = new Date((currentDay + 1) * 86400000);

  return { used, total, remaining, resetAt };
}
