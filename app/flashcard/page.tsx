import { PrismaClient } from '@prisma/client';
import FlashcardClient from './FlashcardClient';

const prisma = new PrismaClient();

export default async function FlashcardPage() {
  const lessons = await prisma.lesson.findMany({
    select: {
      id: true,
      book: true,
      title_vn: true,
      title_zh: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  return <FlashcardClient lessons={lessons} />;
}
