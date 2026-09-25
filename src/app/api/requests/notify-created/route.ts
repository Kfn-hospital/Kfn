import { NextResponse } from 'next/server';
import { notifyRequestCreated } from '@/lib/email/notifications';
import { requireUser } from '@/lib/auth/apiGuards';

export async function POST(request: Request) {
  const guard = await requireUser();
  if ('error' in guard) return guard.error;

  const { requestId } = await request.json();

  if (!requestId) {
    return NextResponse.json({ ok: false, error: 'بيانات ناقصة' }, { status: 400 });
  }

  const result = await notifyRequestCreated(requestId);
  return NextResponse.json(result);
}
