import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { apiKey } = await request.json();

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'Missing API key' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with the single word: OK' }] }],
        }),
      }
    );

    const json = await res.json();

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: json.error?.message ?? 'Request failed' }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 200 }
    );
  }
}
