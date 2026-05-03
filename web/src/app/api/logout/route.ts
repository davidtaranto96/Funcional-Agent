import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(publicUrl(req, '/login'), { status: 303 });
}
