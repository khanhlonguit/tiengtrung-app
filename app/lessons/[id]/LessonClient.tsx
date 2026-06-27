'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './lesson.module.css';
import { speak, initVoices } from '@/lib/useTTS';
import { useTheme } from '@/app/ThemeProvider';

type Lesson = { id: number; title_vn: string; title_zh: string; subtitle: string };
type Vocab = {
  id: number; lesson_id: number; order_num: number;
  word_zh: string; pinyin: string; word_type: string;
  meaning_vn: string;
  meaning_hv: string;
  example_zh: string;
  example_pinyin: string;
  example_vn: string;
};
type Grammar = {
  id: number; lesson_id: number; order_num: number;
  title: string; explanation: string; examples: string;
};
type Dialogue = {
  id: number; lesson_id: number; dialogue_num: number; line_order: number;
  speaker: string; text_zh: string; pinyin: string; translation_vn: string;
};
type LessonData = { lesson: Lesson; vocabulary: Vocab[]; grammar: Grammar[]; dialogues: Dialogue[] };

type LessonItem = { id: number; title_vn: string; title_zh: string };

type Tab = 'vocab' | 'grammar' | 'dialogue';

export default function LessonClient({ allLessons }: { allLessons: LessonItem[] }) {
  const params = useParams();
  const router = useRouter();
  const lessonId = Number(params.id);

  const [data, setData] = useState<LessonData | null>(null);
  const [tab, setTab] = useState<Tab>('vocab');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedVocab, setExpandedVocab] = useState<Set<number>>(new Set());
  const [expandedGrammar, setExpandedGrammar] = useState<Set<number>>(new Set());
  const [showPinyin, setShowPinyin] = useState(true);
  const [showVn, setShowVn] = useState(true);
  const { theme, toggleTheme } = useTheme();

  // Handle Sidebar Resize
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Limit sidebar width between 200px and 500px
      const newWidth = Math.min(Math.max(e.clientX, 200), 500);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const fetchLesson = useCallback(async (id: number) => {
    setLoading(true);
    setExpandedVocab(new Set());
    setExpandedGrammar(new Set());
    try {
      const res = await fetch(`/api/lessons/${id}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLesson(lessonId); }, [lessonId, fetchLesson]);

  // Auto-close sidebar on mobile initial load
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, []);

  // Init TTS voices on mount
  useEffect(() => { initVoices(); }, []);

  const speakText = (text: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    speak(text);
  };

  const toggleVocab = (id: number) => {
    setExpandedVocab(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGrammar = (id: number) => {
    setExpandedGrammar(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const groupedDialogues = data?.dialogues.reduce<Record<number, Dialogue[]>>((acc, d) => {
    if (!acc[d.dialogue_num]) acc[d.dialogue_num] = [];
    acc[d.dialogue_num].push(d);
    return acc;
  }, {}) ?? {};

  return (
    <div 
      className={styles.layout} 
      data-sidebar={sidebarOpen ? 'open' : 'closed'}
      data-dragging={isDragging}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      {/* ── SIDEBAR ── */}
      <nav className={styles.sidebar}>
        {/* Resizer Handle */}
        <div 
          className={styles.resizer} 
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }} 
        />
        <div className={styles.sidebarLogo}>
          <div className={styles.logoIcon}>中</div>
          <div className={styles.logoText}>
            <span className={styles.logoMain}>Đương Đại 1</span>
            <span className={styles.logoSub}>Tiếng Trung</span>
          </div>
        </div>

        <div className={styles.navSection}>
          <div className={styles.navLabel}>Công cụ</div>
          <Link href="/flashcard" className={`${styles.navItem} ${styles.navFlashcard}`}>
            <span className={styles.navFlashIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
              </svg>
            </span>
            <span className={styles.navText}>
              <span className={styles.navTitle}>Ôn Flashcard</span>
              <span className={styles.navSub}>Lưu loát từ vựng</span>
            </span>
          </Link>

          <div className={styles.navLabel} style={{ marginTop: 16 }}>Bài Học</div>
          {allLessons.map(l => (
            <Link
              key={l.id}
              href={`/lessons/${l.id}`}
              className={`${styles.navItem} ${l.id === lessonId ? styles.navItemActive : ''}`}
              onClick={() => {
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}
            >
              <span className={styles.navNum}>{String(l.id).padStart(2, '0')}</span>
              <span className={styles.navText}>
                <span className={styles.navTitle}>{l.title_vn}</span>
                <span className={styles.navSub}>{l.title_zh}</span>
              </span>
            </Link>
          ))}
        </div>


      </nav>

      {/* Mobile Overlay Backdrop */}
      {sidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── MAIN ── */}
      <main className={styles.main}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.menuBtn} onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            {data && (
              <div className={styles.breadcrumb}>
                <span className={styles.breadLesson}>Bài {lessonId}</span>
                <span className={styles.breadSep}>›</span>
                <span className={styles.breadTab}>
                  {tab === 'vocab' ? 'Từ Vựng' : tab === 'grammar' ? 'Ngữ Pháp' : 'Hội Thoại'}
                </span>
              </div>
            )}
          </div>
          <div className={styles.topbarRight}>
            <div className={styles.tabs}>
              {(['vocab', 'grammar', 'dialogue'] as Tab[]).map(t => (
                <button
                  key={t}
                  className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                  onClick={() => setTab(t)}
                >
                  {t === 'vocab' ? '📖 Từ Vựng' : t === 'grammar' ? '📝 Ngữ Pháp' : '💬 Hội Thoại'}
                </button>
              ))}
              <Link href="/flashcard" className={`${styles.tab} ${styles.tabFlash}`}>
                🏃️ Flashcard
              </Link>
            </div>
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
        </header>

        {/* Mobile tab strip — visible only on small screens */}
        <div className={styles.mobileTabStrip}>
          {(['vocab', 'grammar', 'dialogue'] as Tab[]).map(t => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'vocab' ? '📖 Từ Vựng' : t === 'grammar' ? '📝 Ngữ Pháp' : '💬 Hội Thoại'}
            </button>
          ))}
          <Link href="/flashcard" className={`${styles.tab} ${styles.tabFlash}`}>
            🃏 Flashcard
          </Link>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}/>
              <p>Đang tải...</p>
            </div>
          ) : data ? (
            <>
              {/* Lesson hero */}
              <div className={styles.lessonHero}>
                <div className={styles.heroTag}>Bài {lessonId}</div>
                <h1 className={styles.heroZh}>{data.lesson.title_zh}</h1>
                <p className={styles.heroVn}>{data.lesson.title_vn}</p>
                <p className={styles.heroSub}>{data.lesson.subtitle}</p>
              </div>

              {/* VOCAB TAB */}
              {tab === 'vocab' && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2>Từ Vựng</h2>
                    <span className={styles.badge}>{data.vocabulary.length} từ</span>
                  </div>
                  <div className={styles.vocabList}>
                    {/* Header row */}
                    <div className={styles.vocabListHeader}>
                      <span className={styles.colNum}>#</span>
                      <span className={styles.colZh}>Chữ Hán</span>
                      <span className={styles.colPinyin}>Pinyin</span>
                      <span className={styles.colHv}>Hán Việt</span>
                      <span className={styles.colType}>Loại</span>
                      <span className={styles.colMeaning}>Nghĩa</span>
                      <span className={styles.colExpand}></span>
                    </div>
                    {data.vocabulary.map(v => (
                      <div key={v.id} className={styles.vocabListWrap}>
                        <div
                          className={`${styles.vocabRow} ${expandedVocab.has(v.id) ? styles.vocabRowOpen : ''}`}
                          onClick={() => toggleVocab(v.id)}
                        >
                          <span className={styles.colNum}>{v.order_num}</span>
                          <span className={styles.colZh}>
                            <span className={styles.vocabZh}>{v.word_zh}</span>
                            <button
                              className={styles.speakBtn}
                              onClick={e => speakText(v.word_zh, e)}
                              title="Phát âm"
                              aria-label={`Phát âm ${v.word_zh}`}
                            >
                              🔊
                            </button>
                          </span>
                          <span className={styles.colPinyin}>{v.pinyin}</span>
                          <span className={styles.colHv}>{v.meaning_hv}</span>
                          <span className={styles.colType}>
                            {v.word_type && <span className={styles.vocabType}>{v.word_type}</span>}
                          </span>
                          <span className={styles.colMeaning}>{v.meaning_vn}</span>
                          <span className={styles.colExpand}>
                            <svg
                              className={`${styles.vocabChevron} ${expandedVocab.has(v.id) ? styles.chevronOpen : ''}`}
                              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              width="15" height="15"
                            >
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </span>
                        </div>
                        {expandedVocab.has(v.id) && v.example_zh && (
                          <div className={styles.vocabExample}>
                            <div className={styles.exampleRow}>
                              <p className={styles.exZh}>{v.example_zh}</p>
                              <button
                                className={styles.speakBtnSm}
                                onClick={e => speakText(v.example_zh, e)}
                                title="Phát âm câu ví dụ"
                                aria-label="Phát âm câu ví dụ"
                              >🔊</button>
                            </div>
                            <p className={styles.exPinyin}>{v.example_pinyin}</p>
                            <p className={styles.exVn}>{v.example_vn}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* GRAMMAR TAB */}
              {tab === 'grammar' && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2>Ngữ Pháp</h2>
                    <span className={styles.badge}>{data.grammar.length} điểm ngữ pháp</span>
                  </div>
                  <div className={styles.grammarList}>
                    {data.grammar.map((g, i) => {
                      const examples = JSON.parse(g.examples) as { zh: string; pinyin: string; vn: string }[];
                      const isOpen = expandedGrammar.has(g.id);
                      return (
                        <div key={g.id} className={`${styles.grammarCard} ${isOpen ? styles.grammarOpen : ''}`}>
                          <button className={styles.grammarHeader} onClick={() => toggleGrammar(g.id)}>
                            <div className={styles.grammarHeaderLeft}>
                              <span className={styles.grammarNum}>{i + 1}</span>
                              <span className={styles.grammarTitle}>{g.title}</span>
                            </div>
                            <svg
                              className={`${styles.grammarChevron} ${isOpen ? styles.chevronOpen : ''}`}
                              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              width="18" height="18"
                            >
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </button>
                          {isOpen && (
                            <div className={styles.grammarBody}>
                              <p className={styles.grammarExplanation}>{g.explanation}</p>
                              {examples.length > 0 && (
                                <div className={styles.grammarExamples}>
                                  <div className={styles.examplesLabel}>Ví dụ:</div>
                                  {examples.map((ex, j) => (
                                    <div key={j} className={styles.exampleItem}>
                                      <div className={styles.exampleRow}>
                                        <p className={styles.exZh}>{ex.zh}</p>
                                        <button
                                          className={styles.speakBtnSm}
                                          onClick={e => speakText(ex.zh, e)}
                                          title="Phát âm"
                                          aria-label="Phát âm"
                                        >🔊</button>
                                      </div>
                                      <p className={styles.exPinyin}>{ex.pinyin}</p>
                                      <p className={styles.exVn}>{ex.vn}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* DIALOGUE TAB */}
              {tab === 'dialogue' && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionHeaderLeft}>
                      <h2>Hội Thoại</h2>
                      <span className={styles.badge}>{Object.keys(groupedDialogues).length} đoạn hội thoại</span>
                    </div>
                    <div className={styles.toggleGroup}>
                      <button
                        className={`${styles.toggleBtn} ${showPinyin ? styles.toggleBtnOn : ''}`}
                        onClick={() => setShowPinyin(p => !p)}
                      >
                        <span className={styles.toggleDot}/>
                        Pinyin
                      </button>
                      <button
                        className={`${styles.toggleBtn} ${showVn ? styles.toggleBtnOn : ''}`}
                        onClick={() => setShowVn(v => !v)}
                      >
                        <span className={styles.toggleDot}/>
                        Tiếng Việt
                      </button>
                    </div>
                  </div>
                  {Object.entries(groupedDialogues).map(([num, lines]) => (
                    <div key={num} className={styles.dialogueBlock}>
                      <div className={styles.dialogueBlockTitle}>Hội thoại {num}</div>
                      <div className={styles.dialogueLines}>
                        {lines.map(line => (
                          <div key={line.id} className={styles.dialogueLine}>
                            <div className={styles.dialogueSpeaker}>{line.speaker}</div>
                            <div className={styles.dialogueContent}>
                              <div className={styles.dialogueZhRow}>
                                <p className={styles.dialogueZh}>{line.text_zh}</p>
                                <button
                                  className={styles.speakBtnSm}
                                  onClick={() => speak(line.text_zh)}
                                  title="Phát âm"
                                  aria-label={`Phát âm dòng thoại của ${line.speaker}`}
                                >🔊</button>
                              </div>
                              {showPinyin && <p className={styles.dialoguePinyin}>{line.pinyin}</p>}
                              {showVn && <p className={styles.dialogueVn}>{line.translation_vn}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </>
          ) : (
            <div className={styles.error}>Không tìm thấy bài học.</div>
          )}
        </div>
      </main>
    </div>
  );
}
