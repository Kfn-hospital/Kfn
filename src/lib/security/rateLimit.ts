// حماية بسيطة من تكرار المحاولات (Rate Limiting) لمسارات الـ API العامة
// اللي بتتنادى قبل تسجيل الدخول (مفيش جلسة نتحقق منها).
//
// ملاحظة مهمة: الحساب بيتم في الذاكرة (in-memory) داخل نفس الـ serverless instance،
// يعني بيتصفّر لو السيرفر عمل cold start أو لو فيه أكتر من instance شغال في نفس الوقت.
// ده كافي كخط دفاع أول يوقف أي محاولة تلقائية (bot) بسيطة، لكن لو حبينا حماية
// موحّدة وثابتة عبر كل السيرفرات لازم نستخدم مخزن خارجي زي Upstash Redis.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let opCount = 0;

function cleanupExpired() {
  opCount += 1;
  if (opCount % 200 !== 0) return;
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  cleanupExpired();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
