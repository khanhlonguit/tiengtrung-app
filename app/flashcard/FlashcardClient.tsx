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
  meaning_en?: string;
  meaning_hv: string;
  example_zh: string;
  example_pinyin: string;
  example_vn: string;
  example_en?: string;
};

type LessonItem = {
  id: number;
  title_vn: string;
  title_zh: string;
};

type Phase = 'select' | 'study' | 'quiz' | 'quiz_result';

type QuizOption = {
  text: string;
  isCorrect: boolean;
};

type QuizQuestion = {
  questionText: string;
  questionType?: string;
  options: QuizOption[];
  originalWord: Vocab;
};

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
  
  // Quiz states
  const [quizCount, setQuizCount] = useState<number>(10);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
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


  const generateQuiz = (data: Vocab[], count: number) => {
    if (data.length === 0) return [];
    const shuffledData = shuffle(data);
    const selectedVocabs = shuffledData.slice(0, count);
    
    return selectedVocabs.map(vocab => {
      const type = Math.floor(Math.random() * 4);
      let qText = '';
      let correctAnsText = '';
      let questionType = '';
      
      if (type === 0) {
        questionType = 'Việt → Trung (có Pinyin)';
        qText = vocab.meaning_vn;
        correctAnsText = `${vocab.word_zh} (${vocab.pinyin})`;
      } else if (type === 1) {
        questionType = 'Việt → Trung';
        qText = vocab.meaning_vn;
        correctAnsText = vocab.word_zh;
      } else if (type === 2) {
        questionType = 'Trung → Việt (có Pinyin)';
        qText = vocab.word_zh;
        correctAnsText = `${vocab.meaning_vn} (${vocab.pinyin})`;
      } else {
        questionType = 'Trung → Việt';
        qText = vocab.word_zh;
        correctAnsText = vocab.meaning_vn;
      }

      const distractors = shuffle(data.filter(v => v.id !== vocab.id)).slice(0, 3);
      const wrongOptions = distractors.map(d => {
        if (type === 0) return `${d.word_zh} (${d.pinyin})`;
        if (type === 1) return d.word_zh;
        if (type === 2) return `${d.meaning_vn} (${d.pinyin})`;
        return d.meaning_vn;
      });

      while (wrongOptions.length < 3) {
        wrongOptions.push(`N/A ${wrongOptions.length}`);
      }

      const options = shuffle([
        { text: correctAnsText, isCorrect: true },
        ...wrongOptions.map(t => ({ text: t, isCorrect: false }))
      ]);

      return { questionText: qText, questionType, options, originalWord: vocab };
    });
  };

  const startQuiz = async () => {
    if (selectedLessons.size === 0) return;
    setLoading(true);
    try {
      const ids = Array.from(selectedLessons).join(',');
      const res = await fetch(`/api/flashcard?lessons=${ids}`);
      const data: Vocab[] = await res.json();
      setCards(data);
      
      const questions = generateQuiz(data, quizCount);
      setQuizQuestions(questions);
      setCurrentIndex(0);
      setScore(0);
      setSelectedOption(null);
      setPhase('quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleQuizAnswer = (idx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    const isCorrect = quizQuestions[currentIndex].options[idx].isCorrect;
    if (isCorrect) {
      setScore(s => s + 1);
    }
    
    // Nếu câu hỏi không phải tiếng Trung, ta đọc từ Tiếng Trung lên cho người dùng nghe
    const currentQ = quizQuestions[currentIndex];
    if (currentQ.questionText === currentQ.originalWord.meaning_vn) {
      speak(currentQ.originalWord.word_zh);
    } else {
       // Nếu câu hỏi là tiếng Trung, đọc luôn
       speak(currentQ.originalWord.word_zh);
    }
  };

  const nextQuizQuestion = () => {
    if (currentIndex < quizQuestions.length - 1) {
      setCurrentIndex(i => i + 1);
      setSelectedOption(null);
    } else {
      setPhase('quiz_result');
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

  // Auto-speak on flip
  useEffect(() => {
    if (flipped && current) {
      speak(current.word_zh);
    }
  }, [flipped, current]);

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


      {phase === 'select' && (

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

                        <div className={styles.quizSettings}>
              <label htmlFor='quizCount'>Số câu trắc nghiệm:</label>
              <select id='quizCount' value={quizCount} onChange={e => setQuizCount(Number(e.target.value))} className={styles.quizSelect}>
                <option value={5}>5 câu</option>
                <option value={10}>10 câu</option>
                <option value={15}>15 câu</option>
                <option value={20}>20 câu</option>
                <option value={9999}>Tất cả</option>
              </select>
            </div>
            <div className={styles.actionButtons}>
              <button
                className={styles.startBtn}
                onClick={startStudy}
                disabled={selectedLessons.size === 0 || loading}
              >
                {loading ? 'Đang tải...' : '▶ Bắt đầu ôn tập'}
              </button>
              <button
                className={`${styles.startBtn} ${styles.quizBtn}`}
                onClick={startQuiz}
                disabled={selectedLessons.size === 0 || loading}
              >
                {loading ? 'Đang tải...' : '📝 Làm Trắc Nghiệm'}
              </button>
            </div>
            <p className={styles.hint}>Phím tắt: ← → điều hướng · Enter lật thẻ</p>
          </div>
        </div>
      )} {phase === 'study' && (
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
                  {current.meaning_en && (
                    <div className={styles.cardHv} style={{ fontSize: '15px', color: 'var(--text-faint)' }}>
                      {current.meaning_en}
                    </div>
                  )}
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
                      {current.example_en && (
                        <p className={styles.exEn}>{current.example_en}</p>
                      )}
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

      {phase === 'quiz' && quizQuestions.length > 0 && (
        <div className={styles.quizWrap}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${((currentIndex + 1) / quizQuestions.length) * 100}%` }}/>
          </div>
          <div className={styles.progressText}>
            <span>Câu {currentIndex + 1} / {quizQuestions.length}</span>
            <span className={styles.lessonTag}>Điểm: {score}</span>
          </div>

          <div className={styles.quizQuestionArea}>
            <div className={styles.quizQuestionText}>{quizQuestions[currentIndex].questionText}</div>
            <div className={styles.quizQuestionType}>{quizQuestions[currentIndex].questionType}</div>
          </div>

          <div className={styles.quizOptions}>
            {quizQuestions[currentIndex].options.map((opt, idx) => {
              let btnClass = styles.quizOptionBtn;
              if (selectedOption !== null) {
                if (opt.isCorrect) {
                  btnClass += ` ${styles.quizOptionCorrect}`;
                } else if (idx === selectedOption) {
                  btnClass += ` ${styles.quizOptionWrong}`;
                } else {
                  btnClass += ` ${styles.quizOptionFaded}`;
                }
              }
              return (
                <button
                  key={idx}
                  className={btnClass}
                  onClick={() => handleQuizAnswer(idx)}
                  disabled={selectedOption !== null}
                >
                  {opt.text}
                </button>
              );
            })}
          </div>

          {selectedOption !== null && (
            <button className={styles.quizNextBtn} onClick={nextQuizQuestion}>
              {currentIndex < quizQuestions.length - 1 ? 'Tiếp tục →' : 'Xem kết quả'}
            </button>
          )}
        </div>
      )}

      {phase === 'quiz_result' && (
        <div className={styles.quizResultBox}>
          <div className={styles.quizResultIcon}>🏆</div>
          <h2 className={styles.selectTitle}>Hoàn thành!</h2>
          <div className={styles.quizScoreText}>Điểm của bạn</div>
          <div className={styles.quizScoreNumber}>{score} / {quizQuestions.length}</div>
          
          <button className={`${styles.quizActionBtn} ${styles.quizActionPrimary}`} onClick={startQuiz}>
            ↺ Làm lại trắc nghiệm
          </button>
          <button className={styles.quizActionBtn} onClick={() => setPhase('select')}>
            ⚙ Chọn bài khác
          </button>
        </div>
      )}
    </div>
  );
}
