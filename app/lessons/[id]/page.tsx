import { PrismaClient } from '@prisma/client';
import LessonClient from './LessonClient';

const prisma = new PrismaClient();

export default async function LessonPage() {
  const allLessons = await prisma.lesson.findMany({
    select: {
      id: true,
      title_vn: true,
      title_zh: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  return <LessonClient allLessons={allLessons} />;
}
