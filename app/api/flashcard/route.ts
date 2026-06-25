import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lessonsParam = searchParams.get('lessons') ?? '1';
  const lessonIds = lessonsParam.split(',').map(Number).filter(Boolean);

  const vocabulary = await prisma.vocabulary.findMany({
    where: { lesson_id: { in: lessonIds } },
    orderBy: [{ lesson_id: 'asc' }, { order_num: 'asc' }],
  });

  return NextResponse.json(vocabulary);
}
