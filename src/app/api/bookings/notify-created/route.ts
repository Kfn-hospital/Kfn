import { NextResponse } from 'next/server';
import { notifyBookingCreated } from '@/lib/email/notifications';
import { requireUser } from '@/lib/auth/apiGuards';

export async function POST(request: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const { bookingId } = await request.json();

  if (!bookingId) {
    return NextResponse.json({ ok: false, error: 'بيانات ناقصة' }, { status: 400 });
  }

  const result = await notifyBookingCreated(bookingId);
  return NextResponse.json(result);
}
