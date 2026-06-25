import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting DB Seeding from JSON files...');
  
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    console.log('No data directory found. Skipping seeding.');
    return;
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    console.log(`Processing ${file}...`);
    
    const lessonId = data.id;

    // Delete if exists to avoid dupes
    await prisma.dialogue.deleteMany({ where: { lesson_id: lessonId } });
    await prisma.grammar.deleteMany({ where: { lesson_id: lessonId } });
    await prisma.vocabulary.deleteMany({ where: { lesson_id: lessonId } });
    await prisma.lesson.deleteMany({ where: { id: lessonId } });

    // Create Lesson
    await prisma.lesson.create({
      data: {
        id: lessonId,
        title_vn: data.title_vn,
        title_zh: data.title_zh,
        subtitle: data.subtitle,
      },
    });

    // Create Vocabulary
    for (const v of data.vocabulary || []) {
      await prisma.vocabulary.create({ data: { lesson_id: lessonId, ...v } });
    }

    // Create Grammar
    for (const g of data.grammar || []) {
      await prisma.grammar.create({ data: { lesson_id: lessonId, ...g } });
    }

    // Create Dialogues
    for (const d of data.dialogues || []) {
      await prisma.dialogue.create({ data: { lesson_id: lessonId, ...d } });
    }
    
    console.log(`✅ Seeded Lesson ${lessonId} successfully!`);
  }

  console.log('🌱 All seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
