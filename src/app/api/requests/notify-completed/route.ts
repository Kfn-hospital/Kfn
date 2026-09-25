import { NextResponse } from 'next/server';
import { notifyRequestCompleted } from '@/lib/email/notifications';

export async function POST(request: Request) {
  const { requestId } = await request.json();

  if (!requestId) {
    return NextResponse.json({ ok: false, error: 'بيانات ناقصة' }, { status: 400 });
  }

  const result = await notifyRequestCompleted(requestId);
  return NextResponse.json(result);
}
