import { NextResponse } from 'next/server';
import { notifyBookingDecision } from '@/lib/email/notifications';
import { requireUser } from '@/lib/auth/apiGuards';

export async function POST(request: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const { bookingId, decision, reason } = await request.json();

  if (!bookingId || !decision) {
    return NextResponse.json({ ok: false, error: 'بيانات ناقصة' }, { status: 400 });
  }

  const result = await notifyBookingDecision(bookingId, decision, reason);
  return NextResponse.json(result);
}
