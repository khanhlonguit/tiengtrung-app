import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lessonId = parseInt(id);

  const [lesson, vocabulary, grammar, dialogues, exercises] = await Promise.all([
    prisma.lesson.findUnique({ where: { id: lessonId } }),
    prisma.vocabulary.findMany({
      where: { lesson_id: lessonId },
      orderBy: { order_num: 'asc' },
    }),
    prisma.grammar.findMany({
      where: { lesson_id: lessonId },
      orderBy: { order_num: 'asc' },
    }),
    prisma.dialogue.findMany({
      where: { lesson_id: lessonId },
      orderBy: [{ dialogue_num: 'asc' }, { line_order: 'asc' }],
    }),
    prisma.exercise.findMany({
      where: { lesson_id: lessonId },
      include: { questions: true },
      orderBy: { id: 'asc' },
    })
  ]);

  if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ lesson, vocabulary, grammar, dialogues, exercises });
}
