import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { publicUrl } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const password = String(formData.get('password') || '');

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.redirect(publicUrl(req, '/login?error=1'), { status: 303 });
  }

  const session = await getSession();
  session.authed = true;
  session.user = { name: 'David Taranto', email: 'admin' };
  await session.save();

  return NextResponse.redirect(publicUrl(req, '/admin'), { status: 303 });
}
