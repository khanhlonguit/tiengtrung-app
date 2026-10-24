import { prisma } from '@/lib/db';
import GameClient from './GameClient';

export default async function GamePage() {
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

  return <GameClient lessons={lessons} />;
}
