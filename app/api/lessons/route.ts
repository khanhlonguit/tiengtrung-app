import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const lessons = await prisma.lesson.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json(lessons);
}
