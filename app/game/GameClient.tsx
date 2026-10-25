'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import fc from '../flashcard/flashcard.module.css';
import styles from './game.module.css';
import { speak, initVoices } from '@/lib/useTTS';
import { useTheme } from '@/app/ThemeProvider';
import { bookName, groupByBook, lessonNumber } from '@/lib/lessons';

type Vocab = {
  id: number; lesson_id: number; order_num: number;
  word_zh: string; pinyin: string; word_type: string;
  meaning_vn: string;
};

type LessonItem = {
  id: number;
  book: number;
  title_vn: string;
  title_zh: string;
};

type Phase = 'select' | 'play' | 'over';

// choice: nhìn chữ Hán → chọn nghĩa tiếng Việt · type: nhìn chữ Hán → gõ pinyin
type Mode = 'choice' | 'type';

type Falling = { uid: number; vocab: Vocab; x: number; y: number; speed: number };
type Pop = { uid: number; x: number; y: number; text: string; born: number };

type Snapshot = {
  words: Falling[];
  pops: Pop[];
  score: number;
  lives: number;
  combo: number;
  level: number;
  paused: boolean;
  targetUid: number | null;
};

type Option = { text: string; isCorrect: boolean };

const MAX_LIVES = 3;
const WORDS_PER_LEVEL = 8;
const POP_MS = 700;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Bỏ dấu thanh, chấp nhận cả "v" lẫn "u" cho ü, bỏ khoảng trắng/dấu nháy
function normPinyin(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/ü/g, 'u')
    .replace(/[̀-ͯ]/g, '')
    .replace(/v/g, 'u')
    .replace(/[^a-z]/g, '');
}

function pinyinVariants(pinyin: string): string[] {
  return pinyin.split(/[,/;]/).map(normPinyin).filter(Boolean);
}

// Độ khó theo điểm: dưới EASY_SCORE giữ tốc độ chậm, sau đó cứ mỗi RAMP_STEP điểm tăng thêm một nấc
const EASY_SCORE = 500;
const RAMP_STEP = 300;

function difficulty(score: number): number {
  return Math.max(0, score - EASY_SCORE) / RAMP_STEP;
}

// Thời gian rơi hết màn hình (giây): 12s lúc đầu, nhanh nhất 4s
function fallSpeed(score: number): number {
  const seconds = Math.max(4, 12 - difficulty(score) * 0.8);
  return 1 / seconds;
}

function spawnInterval(score: number): number {
  return Math.max(1.1, 3.2 - difficulty(score) * 0.2);
}

function maxOnScreen(score: number): number {
  return Math.min(5, 2 + Math.floor(difficulty(score) / 2));
}

function readBest(mode: Mode): number {
  try {
    return Number(localStorage.getItem(`fallingWords.best.${mode}`)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(mode: Mode, score: number) {
  try {
    localStorage.setItem(`fallingWords.best.${mode}`, String(score));
  } catch {
    // bỏ qua nếu trình duyệt chặn storage
  }
}

type GameState = {
  pool: Vocab[];
  deck: Vocab[];
  words: Falling[];
  pops: Pop[];
  nextUid: number;
  spawnTimer: number;
  lastX: number;
  score: number;
  lives: number;
  combo: number;
  correct: number;
  level: number;
  paused: boolean;
  over: boolean;
  missed: Map<number, Vocab>;
  targetUid: number | null;
};

function newGame(pool: Vocab[]): GameState {
  return {
    pool,
    deck: shuffle(pool),
    words: [],
    pops: [],
    nextUid: 1,
    spawnTimer: 0,
    lastX: 50,
    score: 0,
    lives: MAX_LIVES,
    combo: 0,
    correct: 0,
    level: 1,
    paused: false,
    over: false,
    missed: new Map(),
    targetUid: null,
  };
}

function lowestWord(g: GameState): Falling | null {
  let best: Falling | null = null;
  for (const w of g.words) if (!best || w.y > best.y) best = w;
  return best;
}

function buildOptions(target: Vocab, pool: Vocab[]): Option[] {
  const seen = new Set([target.meaning_vn]);
  const wrong: string[] = [];
  for (const v of shuffle(pool)) {
    if (wrong.length >= 3) break;
    if (seen.has(v.meaning_vn)) continue;
    seen.add(v.meaning_vn);
    wrong.push(v.meaning_vn);
  }
  return shuffle([
    { text: target.meaning_vn, isCorrect: true },
    ...wrong.map(text => ({ text, isCorrect: false })),
  ]);
}

export default function GameClient({ lessons }: { lessons: LessonItem[] }) {
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedLessons, setSelectedLessons] = useState<Set<number>>(new Set(lessons.length > 0 ? [lessons[0].id] : []));
  const [mode, setMode] = useState<Mode>('choice');
  const [showPinyin, setShowPinyin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<{ score: number; best: number; isRecord: boolean; correct: number; level: number; missed: Vocab[] } | null>(null);
  const { theme, toggleTheme } = useTheme();

  const gameRef = useRef<GameState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleLesson = (id: number) => {
    setSelectedLessons(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleBook = (ids: number[], on: boolean) => {
    setSelectedLessons(prev => {
      const next = new Set(prev);
      ids.forEach(id => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const startGame = async () => {
    if (selectedLessons.size === 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      const ids = Array.from(selectedLessons).join(',');
      const res = await fetch(`/api/flashcard?lessons=${ids}`);
      const data: Vocab[] = await res.json();
      const pool = data.filter(v => v.word_zh && v.meaning_vn && (mode === 'choice' || pinyinVariants(v.pinyin).length > 0));
      if (pool.length < 4) {
        setError('Cần ít nhất 4 từ vựng — hãy chọn thêm bài.');
        return;
      }
      gameRef.current = newGame(pool);
      setSnap(null);
      setOptions([]);
      setTyped('');
      setWrongIdx(null);
      setResult(null);
      setPhase('play');
    } finally {
      setLoading(false);
    }
  };

  const endGame = (g: GameState) => {
    g.over = true;
    const best = readBest(mode);
    const isRecord = g.score > best;
    if (isRecord) writeBest(mode, g.score);
    setResult({
      score: g.score,
      best: Math.max(best, g.score),
      isRecord,
      correct: g.correct,
      level: g.level,
      missed: Array.from(g.missed.values()),
    });
    setPhase('over');
  };

  const clearWord = (g: GameState, w: Falling) => {
    g.words = g.words.filter(x => x.uid !== w.uid);
    g.combo += 1;
    g.correct += 1;
    const gained = 10 * g.level + Math.min(g.combo - 1, 10) * 2;
    g.score += gained;
    g.level = 1 + Math.floor(g.correct / WORDS_PER_LEVEL);
    g.pops.push({ uid: w.uid, x: w.x, y: w.y, text: `+${gained}`, born: performance.now() });
    speak(w.vocab.word_zh);
  };

  const togglePause = () => {
    const g = gameRef.current;
    if (!g || g.over) return;
    g.paused = !g.paused;
  };

  // ── Game loop ──
  useEffect(() => {
    if (phase !== 'play') return;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const g = gameRef.current;
      if (!g || g.over) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!g.paused) {
        g.spawnTimer -= dt;
        if ((g.spawnTimer <= 0 && g.words.length < maxOnScreen(g.score)) || g.words.length === 0) {
          if (g.deck.length === 0) g.deck = shuffle(g.pool);
          const onScreen = new Set(g.words.map(w => w.vocab.id));
          const idx = g.deck.findIndex(v => !onScreen.has(v.id));
          const [vocab] = g.deck.splice(idx === -1 ? 0 : idx, 1);
          let x = 6 + Math.random() * 64;
          for (let i = 0; i < 5 && Math.abs(x - g.lastX) < 22; i++) x = 6 + Math.random() * 64;
          g.lastX = x;
          g.words.push({ uid: g.nextUid++, vocab, x, y: 0, speed: fallSpeed(g.score) * (0.9 + Math.random() * 0.2) });
          g.spawnTimer = spawnInterval(g.score);
        }

        for (const w of g.words) w.y += w.speed * dt;
        const landed = g.words.filter(w => w.y >= 1);
        if (landed.length > 0) {
          g.words = g.words.filter(w => w.y < 1);
          for (const w of landed) {
            g.lives -= 1;
            g.missed.set(w.vocab.id, w.vocab);
          }
          g.combo = 0;
        }
        g.pops = g.pops.filter(p => now - p.born < POP_MS);

        if (g.lives <= 0) {
          endGame(g);
          return;
        }

        const target = lowestWord(g);
        const targetUid = target ? target.uid : null;
        if (targetUid !== g.targetUid) {
          g.targetUid = targetUid;
          setWrongIdx(null);
          setOptions(target ? buildOptions(target.vocab, g.pool) : []);
        }
      }

      setSnap({
        words: g.words.map(w => ({ ...w })),
        pops: [...g.pops],
        score: g.score,
        lives: g.lives,
        combo: g.combo,
        level: g.level,
        paused: g.paused,
        targetUid: g.targetUid,
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleChoice = (idx: number) => {
    const g = gameRef.current;
    if (!g || g.paused || g.over || wrongIdx !== null) return;
    const target = g.words.find(w => w.uid === g.targetUid);
    const opt = options[idx];
    if (!target || !opt) return;
    if (opt.isCorrect) {
      clearWord(g, target);
    } else {
      // Sai: mất combo và từ bị đẩy xuống nhanh hơn
      g.combo = 0;
      target.y = Math.min(0.98, target.y + 0.12);
      setWrongIdx(idx);
      setTimeout(() => setWrongIdx(null), 450);
    }
  };

  const handleTyped = (value: string) => {
    const g = gameRef.current;
    if (!g || g.paused || g.over) return;
    const norm = normPinyin(value);
    const hit = [...g.words]
      .sort((a, b) => b.y - a.y)
      .find(w => pinyinVariants(w.vocab.pinyin).includes(norm));
    if (hit) {
      clearWord(g, hit);
      setTyped('');
    } else {
      setTyped(value);
    }
  };

  // Phím tắt: 1–4 chọn đáp án, Esc tạm dừng
  useEffect(() => {
    if (phase !== 'play') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); togglePause(); return; }
      if (mode === 'choice' && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handleChoice(Number(e.key) - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Tự tạm dừng khi rời tab
  useEffect(() => {
    if (phase !== 'play') return;
    const handler = () => {
      const g = gameRef.current;
      if (g && document.hidden) g.paused = true;
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [phase]);

  useEffect(() => {
    if (phase === 'play' && mode === 'type' && !snap?.paused) inputRef.current?.focus();
  }, [phase, mode, snap?.paused]);

  useEffect(() => { initVoices(); }, []);

  return (
    <div className={fc.page}>
      <div className={fc.pageHeader}>
        <Link href="/lessons/1" className={fc.backLink}>
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

      {phase === 'select' && (
        /* ── SELECT PHASE ── */
        <div className={fc.selectWrap}>
          <div className={fc.selectBox}>
            <div className={fc.selectIcon}>🌧️</div>
            <h1 className={fc.selectTitle}>Chữ Rơi</h1>
            <p className={fc.selectDesc}>Hạ gục chữ Hán trước khi chúng chạm đất!</p>

            <div className={styles.modeGrid}>
              <button
                type="button"
                className={`${styles.modeCard} ${mode === 'choice' ? styles.modeCardOn : ''}`}
                onClick={() => setMode('choice')}
                aria-pressed={mode === 'choice'}
              >
                <span className={styles.modeIcon}>🎯</span>
                <span className={styles.modeName}>Chọn nghĩa</span>
                <span className={styles.modeDesc}>Chọn nghĩa tiếng Việt đúng</span>
              </button>
              <button
                type="button"
                className={`${styles.modeCard} ${mode === 'type' ? styles.modeCardOn : ''}`}
                onClick={() => setMode('type')}
                aria-pressed={mode === 'type'}
              >
                <span className={styles.modeIcon}>⌨️</span>
                <span className={styles.modeName}>Gõ pinyin</span>
                <span className={styles.modeDesc}>Gõ pinyin không cần dấu</span>
              </button>
            </div>

            {mode === 'choice' && (
              <label className={styles.checkRow}>
                <input type="checkbox" checked={showPinyin} onChange={e => setShowPinyin(e.target.checked)} />
                Hiện pinyin trên chữ rơi
              </label>
            )}

            <div className={fc.selectSummary}>
              Đã chọn <strong>{selectedLessons.size}</strong> bài
              {selectedLessons.size > 0 && (
                <button type="button" className={fc.linkBtn} onClick={() => setSelectedLessons(new Set())}>
                  Bỏ chọn hết
                </button>
              )}
            </div>

            <div className={fc.bookList}>
              {groupByBook(lessons).map(group => {
                const ids = group.lessons.map(l => l.id);
                const pickedCount = ids.filter(id => selectedLessons.has(id)).length;
                const allPicked = pickedCount === ids.length;
                return (
                  <div key={group.book} className={fc.bookBlock}>
                    <div className={fc.bookHead}>
                      <span className={fc.bookTitle}>{bookName(group.book)}</span>
                      <span className={fc.bookPicked}>{pickedCount}/{ids.length}</span>
                      <button
                        type="button"
                        className={fc.linkBtn}
                        onClick={() => toggleBook(ids, !allPicked)}
                      >
                        {allPicked ? 'Bỏ chọn' : 'Chọn cả cuốn'}
                      </button>
                    </div>
                    <div className={fc.lessonGrid}>
                      {group.lessons.map(l => {
                        const on = selectedLessons.has(l.id);
                        return (
                          <button
                            type="button"
                            key={l.id}
                            className={`${fc.lessonChip} ${on ? fc.lessonChipOn : ''}`}
                            onClick={() => toggleLesson(l.id)}
                            aria-pressed={on}
                            title={`Bài ${lessonNumber(l.id)}: ${l.title_zh}`}
                          >
                            <span className={fc.chipNum}>{lessonNumber(l.id)}</span>
                            <span className={fc.chipZh}>{l.title_zh}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={fc.actionButtons}>
              <button
                className={`${fc.startBtn} ${loading ? fc.btnLoading : ''}`}
                onClick={startGame}
                disabled={selectedLessons.size === 0}
                aria-busy={loading}
              >
                {loading ? 'Đang tải...' : '▶ Bắt đầu chơi'}
              </button>
            </div>
            <p className={fc.hint}>
              {mode === 'choice' ? 'Phím tắt: 1–4 chọn đáp án · Esc tạm dừng' : 'Gõ đúng là tự hạ chữ · Esc tạm dừng'}
            </p>
          </div>
        </div>
      )}

      {phase === 'play' && snap && (
        /* ── PLAY PHASE ── */
        <div className={styles.playWrap}>
          <div className={styles.hud}>
            <span className={styles.hearts} aria-label={`Còn ${snap.lives} mạng`}>
              {Array.from({ length: MAX_LIVES }, (_, i) => (
                <span key={i} className={i < snap.lives ? '' : styles.heartLost}>❤️</span>
              ))}
            </span>
            <span className={styles.hudItem}>Cấp <strong>{snap.level}</strong></span>
            <span className={styles.hudItem}>Điểm <strong>{snap.score}</strong></span>
            {snap.combo >= 2 && <span className={styles.combo}>🔥 x{snap.combo}</span>}
            <button type="button" className={styles.pauseBtn} onClick={togglePause} aria-label="Tạm dừng">
              {snap.paused ? '▶' : '⏸'}
            </button>
          </div>

          <div className={styles.arena}>
            {snap.words.map(w => (
              <div
                key={w.uid}
                className={`${styles.word} ${mode === 'choice' && w.uid === snap.targetUid ? styles.wordTarget : ''} ${w.y > 0.75 ? styles.wordDanger : ''}`}
                style={{ left: `${w.x}%`, top: `calc(${w.y} * (100% - 72px))` }}
              >
                <span className={styles.wordZh}>{w.vocab.word_zh}</span>
                {mode === 'choice' && showPinyin && <span className={styles.wordPinyin}>{w.vocab.pinyin}</span>}
              </div>
            ))}
            {snap.pops.map(p => (
              <div
                key={`pop-${p.uid}`}
                className={styles.pop}
                style={{ left: `${p.x}%`, top: `calc(${p.y} * (100% - 72px))` }}
              >
                {p.text}
              </div>
            ))}
            <div className={styles.ground} />

            {snap.paused && (
              <div className={styles.pauseOverlay}>
                <div className={styles.pauseTitle}>Tạm dừng</div>
                <button type="button" className={fc.startBtn} onClick={togglePause}>▶ Chơi tiếp</button>
                <button type="button" className={styles.quitBtn} onClick={() => gameRef.current && endGame(gameRef.current)}>
                  Kết thúc ván
                </button>
              </div>
            )}
          </div>

          {mode === 'choice' ? (
            <div className={styles.options}>
              {options.map((opt, idx) => (
                <button
                  key={`${snap.targetUid}-${idx}`}
                  type="button"
                  className={`${styles.optionBtn} ${wrongIdx === idx ? styles.optionWrong : ''}`}
                  onClick={() => handleChoice(idx)}
                  disabled={snap.paused}
                >
                  <span className={styles.optionKey}>{idx + 1}</span>
                  {opt.text}
                </button>
              ))}
            </div>
          ) : (
            <input
              ref={inputRef}
              className={styles.typeInput}
              value={typed}
              onChange={e => handleTyped(e.target.value)}
              placeholder="Gõ pinyin, VD: nihao"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={snap.paused}
              aria-label="Gõ pinyin của chữ đang rơi"
            />
          )}
        </div>
      )}

      {phase === 'over' && result && (
        /* ── GAME OVER ── */
        <div className={fc.quizResultBox}>
          <div className={fc.quizResultIcon}>{result.isRecord ? '🏆' : '💥'}</div>
          <h2 className={fc.selectTitle}>{result.isRecord ? 'Kỷ lục mới!' : 'Hết mạng!'}</h2>
          <div className={fc.quizScoreText}>Điểm của bạn</div>
          <div className={fc.quizScoreNumber}>{result.score}</div>
          <p className={styles.resultMeta}>
            Hạ {result.correct} chữ · Đạt cấp {result.level} · Kỷ lục: {result.best}
          </p>

          {result.missed.length > 0 && (
            <div className={styles.missed}>
              <div className={styles.missedTitle}>Từ bị rơi mất — ôn lại nhé</div>
              {result.missed.map(v => (
                <div key={v.id} className={styles.missedRow}>
                  <span className={styles.missedZh}>{v.word_zh}</span>
                  <span className={styles.missedPinyin}>{v.pinyin}</span>
                  <span className={styles.missedVn}>{v.meaning_vn}</span>
                  <button type="button" className={styles.missedSpeak} onClick={() => speak(v.word_zh)} aria-label={`Phát âm ${v.word_zh}`}>
                    🔊
                  </button>
                </div>
              ))}
            </div>
          )}

          <button className={`${fc.quizActionBtn} ${fc.quizActionPrimary}`} onClick={startGame}>
            ↺ Chơi lại
          </button>
          <button className={fc.quizActionBtn} onClick={() => setPhase('select')}>
            ⚙ Chọn bài khác
          </button>
        </div>
      )}
    </div>
  );
}
