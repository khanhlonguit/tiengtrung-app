'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import styles from './flashcard.module.css';
import { speak, initVoices } from '@/lib/useTTS';
import { useTheme } from '@/app/ThemeProvider';

type Vocab = {
  id: number; lesson_id: number; order_num: number;
  word_zh: string; pinyin: string; word_type: string;
  meaning_vn: string;
  meaning_hv: string;
  example_zh: string;
  example_pinyin: string;
  example_vn: string;
};

type LessonItem = {
  id: number;
  title_vn: string;
  title_zh: string;
};

type Phase = 'select' | 'study';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FlashcardClient({ lessons }: { lessons: LessonItem[] }) {
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedLessons, setSelectedLessons] = useState<Set<number>>(new Set(lessons.length > 0 ? [lessons[0].id] : []));
  const [cards, setCards] = useState<Vocab[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const toggleLesson = (id: number) => {
    setSelectedLessons(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const totalWords = useCallback(async () => {
    // just a count estimate
    return selectedLessons.size * 30;
  }, [selectedLessons]);

  const startStudy = async () => {
    if (selectedLessons.size === 0) return;
    setLoading(true);
    try {
      const ids = Array.from(selectedLessons).join(',');
      const res = await fetch(`/api/flashcard?lessons=${ids}`);
      const data: Vocab[] = await res.json();
      setCards(data);
      setCurrentIndex(0);
      setFlipped(false);
      setPhase('study');
    } finally {
      setLoading(false);
    }
  };

  const current = cards[currentIndex];

  const goNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(i => i + 1);
      setFlipped(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setFlipped(false);
    }
  };

  const doShuffle = () => {
    setCards(shuffle(cards));
    setCurrentIndex(0);
    setFlipped(false);
  };

  const doRestart = () => {
    setCurrentIndex(0);
    setFlipped(false);
  };

  // Keyboard navigation
  useEffect(() => {
    if (phase !== 'study') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f); }
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); if (current) speak(current.word_zh); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, currentIndex, cards.length]);

  // Init TTS voices
  useEffect(() => { initVoices(); }, []);

  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

  return (
    <div className={styles.page}>
      {/* Header row: back link + theme toggle */}
      <div className={styles.pageHeader}>
        <Link href="/lessons/1" className={styles.backLink}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Quay lại bài học
        </Link>
        <button
          className="themeToggleBtn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Bật chế độ sáng' : 'Bật chế độ tối'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
          {theme === 'dark' ? 'Sáng' : 'Tối'}
        </button>
      </div>

      {phase === 'select' ? (
        /* ── SELECT PHASE ── */
        <div className={styles.selectWrap}>
          <div className={styles.selectBox}>
            <div className={styles.selectIcon}>🃏</div>
            <h1 className={styles.selectTitle}>Ôn Flashcard</h1>
            <p className={styles.selectDesc}>Chọn bài muốn ôn từ vựng</p>

            <div className={styles.lessonChecks}>
              {lessons.map(l => (
                <label
                  key={l.id}
                  className={`${styles.lessonCheck} ${selectedLessons.has(l.id) ? styles.lessonCheckActive : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLessons.has(l.id)}
                    onChange={() => toggleLesson(l.id)}
                    className={styles.checkInput}
                  />
                  <div className={styles.checkContent}>
                    <span className={styles.checkNum}>Bài {l.id}</span>
                    <span className={styles.checkTitle}>{l.title_zh}</span>
                  </div>
                  <div className={`${styles.checkMark} ${selectedLessons.has(l.id) ? styles.checkMarkActive : ''}`}>
                    {selectedLessons.has(l.id) && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="14" height="14">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <button
              className={styles.startBtn}
              onClick={startStudy}
              disabled={selectedLessons.size === 0 || loading}
            >
              {loading ? 'Đang tải...' : `▶ Bắt đầu ôn tập`}
            </button>
            <p className={styles.hint}>Phím tắt: ← → điều hướng · Enter lật thẻ</p>
          </div>
        </div>
      ) : (
        /* ── STUDY PHASE ── */
        <div className={styles.studyWrap}>
          {/* Progress bar */}
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }}/>
          </div>
          <div className={styles.progressText}>
            <span>{currentIndex + 1} / {cards.length}</span>
            <span className={styles.lessonTag}>Bài {current?.lesson_id}</span>
          </div>

          {/* Card */}
          {current && (
            <div
              className={`${styles.cardOuter} ${flipped ? styles.cardFlipped : ''}`}
              onClick={() => setFlipped(f => !f)}
            >
              <div className={styles.cardInner}>
                {/* Front */}
                <div className={styles.cardFront}>
                  <div className={styles.cardZh}>{current.word_zh}</div>
                  <div className={styles.cardPinyin}>{current.pinyin}</div>
                  {current.word_type && (
                    <div className={styles.cardType}>{current.word_type}</div>
                  )}
                  <button
                    className={styles.cardSpeakBtn}
                    onClick={e => { e.stopPropagation(); speak(current.word_zh); }}
                    title="Phát âm (P)"
                    aria-label={`Phát âm ${current.word_zh}`}
                  >
                    🔊 Phát âm
                  </button>
                  <div className={styles.cardHint}>Nhấn để xem nghĩa</div>
                </div>

                {/* Back */}
                <div className={styles.cardBack}>
                  <div className={styles.cardMeaning}>{current.meaning_vn}</div>
                  {current.meaning_hv && (
                    <div className={styles.cardHv}>({current.meaning_hv})</div>
                  )}
                  {current.example_zh && (
                    <div className={styles.cardExample}>
                      <div className={styles.cardExampleZhRow}>
                        <p className={styles.exZh}>{current.example_zh}</p>
                        <button
                          className={styles.cardSpeakBtnSm}
                          onClick={e => { e.stopPropagation(); speak(current.example_zh); }}
                          title="Phát âm câu ví dụ"
                          aria-label="Phát âm câu ví dụ"
                        >🔊</button>
                      </div>
                      <p className={styles.exPinyin}>{current.example_pinyin}</p>
                      <p className={styles.exVn}>{current.example_vn}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className={styles.controls}>
            <button
              className={`${styles.ctrlBtn} ${styles.ctrlPrev}`}
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              ← Trước
            </button>
            <button className={`${styles.ctrlBtn} ${styles.ctrlFlip}`} onClick={() => setFlipped(f => !f)}>
              🔄 Lật thẻ
            </button>
            <button
              className={`${styles.ctrlBtn} ${styles.ctrlNext}`}
              onClick={goNext}
              disabled={currentIndex === cards.length - 1}
            >
              Tiếp →
            </button>
          </div>

          {/* Done state */}
          {currentIndex === cards.length - 1 && flipped && (
            <div className={styles.doneBanner}>
              🎉 Bạn đã ôn xong! Tiếp tục ôn hay xáo bài?
            </div>
          )}

          {/* Shuffle / Restart / Back */}
          <div className={styles.extras}>
            <button className={styles.extraBtn} onClick={doShuffle}>🔀 Xáo bài</button>
            <button className={styles.extraBtn} onClick={doRestart}>↺ Làm lại</button>
            <button className={styles.extraBtn} onClick={() => setPhase('select')}>⚙ Chọn bài</button>
          </div>
        </div>
      )}
    </div>
  );
}
