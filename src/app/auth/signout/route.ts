import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

async function signOut(request: NextRequest) {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  const url = new URL('/login', request.url);
  const reason = request.nextUrl.searchParams.get('reason');
  if (reason) url.searchParams.set('error', reason);
  return NextResponse.redirect(url, { status: 303 });
}

export const GET = signOut;
export const POST = signOut;
