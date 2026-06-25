<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Tiếng Trung Đương Đại 1 — Project Guide

Ứng dụng học tiếng Trung dựa trên giáo trình "Đương Đại 1" (當代中文). Bao gồm từ vựng, ngữ pháp, hội thoại và flashcard cho Bài 1–15.

---

## Tech Stack

| Thành phần | Công nghệ |
|-----------|-----------|
| Framework | Next.js 14 (App Router) |
| ORM | Prisma |
| Database | SQLite (`prisma/data.sqlite`) |
| Styling | Vanilla CSS Modules |
| Language | TypeScript |
| Runtime | Node.js (tsx để chạy seed) |

---

## Cấu trúc thư mục

```
tiengtrung-app/
├── app/
│   ├── ThemeProvider.tsx       # Context dark/light mode (localStorage)
│   ├── layout.tsx              # Root layout + Google Fonts + ThemeProvider
│   ├── globals.css             # CSS variables (--bg-base, --text-primary…)
│   ├── page.tsx                # redirect('/lessons/1')
│   ├── api/
│   │   ├── lessons/[id]/route.ts    # GET /api/lessons/:id → {lesson, vocabulary, grammar, dialogues}
│   │   └── flashcard/route.ts       # GET /api/flashcard?lessons=1,2,3 → Vocab[]
│   ├── lessons/[id]/
│   │   ├── page.tsx            # Server component — fetch allLessons → render LessonClient
│   │   ├── LessonClient.tsx    # Client component — tabs, sidebar, TTS, theme
│   │   └── lesson.module.css   # CSS module cho trang bài học
│   └── flashcard/
│       ├── page.tsx            # Server component — fetch lessons list
│       ├── FlashcardClient.tsx # Client — chọn bài, lật thẻ 3D, TTS
│       └── flashcard.module.css
├── lib/
│   ├── db.ts                   # PrismaClient singleton
│   └── useTTS.ts               # Web Speech API helper (speak, initVoices)
├── prisma/
│   ├── schema.prisma           # Models: Lesson, Vocabulary, Grammar, Dialogue
│   ├── seed.ts                 # Đọc prisma/data/*.json → upsert vào SQLite
│   ├── data.sqlite             # Database file
│   └── data/
│       ├── lesson1.json        # Dữ liệu bài 1
│       ├── lesson2.json
│       └── … lesson15.json     # Hiện có bài 1–15
└── extract_pdf.py              # Script trích xuất PDF → TXT (dùng khi thêm bài mới)
```

---

## Database Schema

```
Lesson         { id, title_vn, title_zh, subtitle }
Vocabulary     { id, lesson_id, order_num, word_zh, pinyin, word_type, meaning_vn,
                 example_zh, example_pinyin, example_vn }
Grammar        { id, lesson_id, order_num, title, explanation, examples (JSON string) }
Dialogue       { id, lesson_id, dialogue_num, line_order, speaker, text_zh, pinyin, translation_vn }
```

`Grammar.examples` là chuỗi JSON dạng `[{zh, pinyin, vn}, ...]`.

---

## Quy trình thêm bài học mới

1. **Extract PDF** → chạy script Python:
   ```bash
   python extract_pdf.py <lesson_number>
   # Tạo ra: extracted_lesson_<N>_utf8.txt (file tạm, đã gitignore)
   ```

2. **Tạo JSON** → đặt vào `prisma/data/lesson<N>.json` theo đúng schema:
   ```json
   {
     "id": N,
     "title_vn": "...",
     "title_zh": "...",
     "subtitle": "...",
     "vocabulary": [ { "order_num": 1, "word_zh": "...", "pinyin": "...",
                       "word_type": "N/V/Adj/…", "meaning_vn": "...",
                       "example_zh": "...", "example_pinyin": "...", "example_vn": "..." } ],
     "grammar":   [ { "order_num": 1, "title": "...", "explanation": "...",
                       "examples": "[{\"zh\":\"...\",\"pinyin\":\"...\",\"vn\":\"...\"}]" } ],
     "dialogues": [ { "dialogue_num": 1, "line_order": 1, "speaker": "A",
                       "text_zh": "...", "pinyin": "...", "translation_vn": "..." } ]
   }
   ```

3. **Seed database**:
   ```bash
   npx prisma db seed
   ```
   Seed tự động đọc `prisma/data/*.json` và upsert tất cả bài.

---

## CSS Theming

- **`globals.css`** định nghĩa tất cả CSS variables trong 2 block:
  - `html[data-theme="dark"]` — màu tối (default)
  - `html[data-theme="light"]` — màu sáng
- Mọi file CSS module **chỉ dùng `var(--tên-biến)`**, không hardcode màu hex.
- Các biến chính: `--bg-base`, `--bg-surface`, `--bg-elevated`, `--text-primary`, `--text-body`, `--text-muted`, `--text-faint`, `--accent`, `--accent-soft`, `--accent-label`, `--border-subtle`
- `ThemeProvider.tsx` lưu preference vào `localStorage` và set `data-theme` trên `<html>`.
- Nút toggle `☀️/🌙` dùng class **global** `themeToggleBtn` (định nghĩa trong `globals.css`).

---

## TTS (Text-to-Speech)

- File: `lib/useTTS.ts`
- Dùng **Web Speech API** của trình duyệt — không cần API key hay thư viện ngoài.
- Ưu tiên giọng: `zh-TW` → `zh-CN` → bất kỳ `zh-*`.
- Gọi `speak(text)` để phát âm, `initVoices()` khi mount để preload voices.
- Nút 🔊 xuất hiện ở: từ vựng (chữ Hán + câu ví dụ), ngữ pháp (câu ví dụ), hội thoại (từng dòng), flashcard (mặt trước + mặt sau).
- Phím tắt flashcard: `←/→` điều hướng, `Enter` lật thẻ, `P` phát âm.

---

## Responsive / Mobile

- Trên màn hình `≤768px`:
  - Sidebar overlay (absolute + z-index 100), đóng/mở qua hamburger ≡
  - Tab strip **ẩn** khỏi topbar → hiện thành strip cuộn ngang dưới topbar (`.mobileTabStrip`)
  - Bảng từ vựng thu gọn từ 6 cột → 3 cột (ẩn pinyin, loại)
  - Hội thoại xếp dọc (speaker trên, nội dung dưới)

---

## Quy tắc quan trọng

- **Không crawl internet** — chỉ dùng PDF có sẵn trong `SachPdf/`.
- **Nguồn dữ liệu duy nhất** là `prisma/data/*.json` → không sửa database trực tiếp.
- **Không thay đổi schema Prisma** nếu không cần thiết — phải chạy migration nếu đổi.
- Dev server: `npm run dev` (cổng 3000).
- Seed: `npx prisma db seed`.
- File tạm `extracted_lesson_*.txt` đã được gitignore — không cần commit.
