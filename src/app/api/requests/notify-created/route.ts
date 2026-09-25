import { NextResponse } from 'next/server';
import { notifyRequestCreated } from '@/lib/email/notifications';

export async function POST(request: Request) {
  const { requestId } = await request.json();

  if (!requestId) {
    return NextResponse.json({ ok: false, error: 'بيانات ناقصة' }, { status: 400 });
  }

  try {
    await notifyRequestCreated(requestId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
