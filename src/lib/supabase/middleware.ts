import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // أي صفحة غير صفحة تسجيل الدخول، وأنت مش مسجّل دخول → روّحي لصفحة الدخول
  // مع الحفاظ على الصفحة اللي كنت رايح لها في next عشان نرجعك ليها بعد الدخول
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    const originalPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.pathname = '/login';
    url.search = '';
    if (originalPath && originalPath !== '/') {
      url.searchParams.set('next', originalPath);
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
