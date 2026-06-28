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
    
    let lessonId = data.id;
    if (!lessonId) {
      const match = file.match(/\d+/);
      if (match) {
        lessonId = parseInt(match[0]);
      }
    }

    if (!lessonId) {
      console.log(`❌ Skipping ${file}: No lesson ID found.`);
      continue;
    }

    console.log(`Processing ${file} (Lesson ID: ${lessonId})...`);

    // Delete if exists to avoid dupes
    const existingExercises = await prisma.exercise.findMany({ where: { lesson_id: lessonId } });
    for (const ex of existingExercises) {
      await prisma.exerciseQuestion.deleteMany({ where: { exercise_id: ex.id } });
    }
    await prisma.exercise.deleteMany({ where: { lesson_id: lessonId } });
    await prisma.dialogue.deleteMany({ where: { lesson_id: lessonId } });
    await prisma.grammar.deleteMany({ where: { lesson_id: lessonId } });
    await prisma.vocabulary.deleteMany({ where: { lesson_id: lessonId } });
    await prisma.lesson.deleteMany({ where: { id: lessonId } });

    // Create Lesson
    await prisma.lesson.create({
      data: {
        id: lessonId,
        title_vn: data.title_vn || `Bài ${lessonId}`,
        title_zh: data.title_zh || `第 ${lessonId} 課`,
        subtitle: data.subtitle || "",
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

    // Create Exercises
    for (const ex of data.exercises || []) {
      const createdEx = await prisma.exercise.create({ 
        data: { 
          lesson_id: lessonId, 
          title: ex.title 
        } 
      });
      for (const q of ex.questions || []) {
        await prisma.exerciseQuestion.create({
          data: {
            exercise_id: createdEx.id,
            question: q.question,
            answer: q.answer,
            hint: q.hint
          }
        });
      }
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
