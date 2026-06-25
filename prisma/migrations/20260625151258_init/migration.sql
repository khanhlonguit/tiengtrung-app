-- CreateTable
CREATE TABLE "Lesson" (
    "id" INTEGER NOT NULL,
    "title_vn" TEXT NOT NULL,
    "title_zh" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vocabulary" (
    "id" SERIAL NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "order_num" INTEGER NOT NULL,
    "word_zh" TEXT NOT NULL,
    "pinyin" TEXT NOT NULL,
    "word_type" TEXT NOT NULL DEFAULT '',
    "meaning_vn" TEXT NOT NULL,
    "example_zh" TEXT NOT NULL DEFAULT '',
    "example_pinyin" TEXT NOT NULL DEFAULT '',
    "example_vn" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grammar" (
    "id" SERIAL NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "order_num" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "examples" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "Grammar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dialogue" (
    "id" SERIAL NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "dialogue_num" INTEGER NOT NULL,
    "line_order" INTEGER NOT NULL,
    "speaker" TEXT NOT NULL,
    "text_zh" TEXT NOT NULL,
    "pinyin" TEXT NOT NULL,
    "translation_vn" TEXT NOT NULL,

    CONSTRAINT "Dialogue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Vocabulary" ADD CONSTRAINT "Vocabulary_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grammar" ADD CONSTRAINT "Grammar_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dialogue" ADD CONSTRAINT "Dialogue_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
