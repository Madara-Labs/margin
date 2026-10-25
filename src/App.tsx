// ============================================================================
// "Margin" — Reader-First Study Tool
// Design Principle: The book stays in the middle. The software adds prompts
// and instruments that make the reader do the thinking, and AI-generated
// content appears only after the reader's own attempt, for comparison.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import {
  BOLTON_1_1_KEY_IDEAS,
  BOLTON_1_1_PRE_QUESTIONS,
  BOLTON_4_2_KEY_IDEAS,
  BOLTON_4_2_LAB_SPEC,
  BOLTON_4_2_PRE_QUESTIONS,
  BOLTON_4_2_SELF_EXPLANATIONS,
  BOLTON_BOOK_STRUCTURE,
  BOLTON_CH4_REFERENCE_MAP,
  INITIAL_PROMPT_LOGS,
  INITIAL_REVISIT_QUEUE,
} from './data/boltonSeed';
import {
  OPENSTAX_8_2_KEY_IDEAS,
  OPENSTAX_8_2_LAB_SPEC,
  OPENSTAX_8_2_PRE_QUESTIONS,
  OPENSTAX_BOOK_STRUCTURE,
} from './data/openstaxSeed';
import {
  BookSection,
  BookStructure,
  ConceptMapSpec,
  ExplorableLabSpec,
  FreeRecallAttempt,
  HighlightItem,
  MarginNote,
  PreQuestion,
  PromptLogEntry,
  RetrievalMapAttempt,
  SectionKeyIdea,
  SliderPrediction,
} from './types/margin';
import {
  buildReaderExport,
  loadLocalBookState,
  PerBookStoreState,
  saveLocalBookState,
} from './lib/storage';
import {
  advanceRevisitItem,
  buildOrUpdateRevisitItem,
} from './lib/revisitScheduler';
import { ExplorableLab } from './components/ExplorableLab';
import { FreeRecallPanel } from './components/FreeRecallPanel';
import { RetrievalMapCanvas } from './components/RetrievalMapCanvas';
import {
  DataToChartBlock,
  DesignedStubsSuite,
  SelfExplanationMarginCard,
} from './components/DesignedStubs';
import {
  buildInstrumentsForBook,
  ingestPdfFileClient,
  ingestPdfSourceClient,
} from './lib/pdfClientIngest';
import { PdfCanvasViewer, PdfRegionCrop } from './components/PdfCanvasViewer';
import { ShowcaseModal } from './components/ShowcaseModal';

/**
 * Renders paragraph text with inline <mark> highlights for any reader highlights
 * anchored to that paragraph.
 */
function renderParagraphWithHighlights(
  text: string,
  highlights: HighlightItem[]
): React.ReactNode {
  if (!highlights || highlights.length === 0) return text;

  const ranges: { start: number; end: number; id: string }[] = [];
  for (const hl of highlights) {
    const needle = hl.selectedText.trim();
    if (!needle) continue;
    let idx = text.indexOf(needle);
    if (idx === -1) {
      idx = text.toLowerCase().indexOf(needle.toLowerCase());
    }
    if (idx !== -1) {
      ranges.push({ start: idx, end: idx + needle.length, id: hl.id });
    }
  }

  if (ranges.length === 0) return text;
  ranges.sort((a, b) => a.start - b.start);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start < cursor) continue;
    if (r.start > cursor) {
      nodes.push(text.slice(cursor, r.start));
    }
    nodes.push(
      <mark key={r.id} className="book-inline-highlight">
        {text.slice(r.start, r.end)}
      </mark>
    );
    cursor = r.end;
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

function copyTextToClipboard(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback if clipboard API permission is denied
    });
  }
}

function generateDefaultPreQuestions(
  bookId: string,
  section: BookSection
): PreQuestion[] {
  const proseParas = section.paragraphs.filter((p) => p.kind === 'prose');
  const firstPara = proseParas[0] || section.paragraphs[0];
  const midPara =
    proseParas[Math.floor(proseParas.length / 2)] || firstPara;
  const lastPara =
    proseParas[proseParas.length - 1] || firstPara;

  const p1Page = firstPara?.page || section.startPage;
  const p1Id = firstPara?.id || `p-${section.id}-1`;

  const p2Page = midPara?.page || section.startPage;
  const p2Id = midPara?.id || `p-${section.id}-2`;

  const p3Page = lastPara?.page || section.endPage;
  const p3Id = lastPara?.id || `p-${section.id}-3`;

  return [
    {
      id: `pq-${bookId}-${section.id}-1`,
      sectionId: section.id,
      question: `Before reading §${section.number} (${section.title}): What core theoretical mechanism or trade-off do you predict this section will establish?`,
      targetParagraphId: p1Id,
      anchor: {
        bookId,
        sectionId: section.id,
        page: p1Page,
        pdfPage: section.pdfStartPage,
        paragraphId: p1Id,
        excerptShort: `p. ${p1Page} — Opening formulation of §${section.number}`,
      },
    },
    {
      id: `pq-${bookId}-${section.id}-2`,
      sectionId: section.id,
      question: `How do you anticipate §${section.number} (${section.title}) modifies or expands the baseline model from Chapter ${section.chapterId}?`,
      targetParagraphId: p2Id,
      anchor: {
        bookId,
        sectionId: section.id,
        page: p2Page,
        pdfPage: section.pdfStartPage,
        paragraphId: p2Id,
        excerptShort: `p. ${p2Page} — Core model development in §${section.number}`,
      },
    },
    {
      id: `pq-${bookId}-${section.id}-3`,
      sectionId: section.id,
      question: `What critical optimality condition, constraint, or equation do you expect to govern the equilibrium in §${section.number}?`,
      targetParagraphId: p3Id,
      anchor: {
        bookId,
        sectionId: section.id,
        page: p3Page,
        pdfPage: section.pdfStartPage,
        paragraphId: p3Id,
        excerptShort: `p. ${p3Page} — Optimality condition in §${section.number}`,
      },
    },
  ];
}

export const App: React.FC = () => {
  // Active Book Selection (supports built-in books + any custom ingested PDF)
  const [activeBookId, setActiveBookId] = useState<string>('bolton-2005');
  const [customBooks, setCustomBooks] = useState<Record<string, BookStructure>>({});
  const [customMaps, setCustomMaps] = useState<Record<string, ConceptMapSpec>>({});
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [tocOpen, setTocOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPageBlurred, setIsPageBlurred] = useState<boolean>(false);

  // Reading scope in Reader Text View: 'section' | 'chapter' | 'book'
  const [readingScope, setReadingScope] = useState<'section' | 'chapter' | 'book'>('section');

  // Jump-to-top floating button state
  const [showJumpToTop, setShowJumpToTop] = useState<boolean>(false);

  // Minimal UI drawers/menus (hidden by default so the reader can focus on reading & noting)
  const [showOptionsMenu, setShowOptionsMenu] = useState<boolean>(false);
  const [showStudyTools, setShowStudyTools] = useState<boolean>(false);
  const [activeStudyTab, setActiveStudyTab] = useState<
    'prequestions' | 'recall' | 'map' | 'lab' | 'more'
  >('recall');

  // Highlight tool state + auto-copy clipboard toast
  const [highlightToolActive, setHighlightToolActive] = useState<boolean>(false);
  const [lastSelection, setLastSelection] = useState<{
    text: string;
    paragraphId: string;
    sectionId: string;
    page: number;
  } | null>(null);
  const [selectionToast, setSelectionToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showQuickToast = useCallback((msg: string) => {
    setSelectionToast(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setSelectionToast(null);
    }, 3200);
  }, []);

  // PDF.js integration state (optional toggle; Reader Text View is primary)
  const [showPdfCanvas, setShowPdfCanvas] = useState<boolean>(false);
  const [uploadedPdfFile, setUploadedPdfFile] = useState<File | null>(null);
  const [targetPdfPage, setTargetPdfPage] = useState<number>(152);
  const [ingestionStatus, setIngestionStatus] = useState<string | null>(null);

  // Panels: Prompt Transparency, Export Modal, Shortcuts Cheatsheet & Welcome Showcase
  const [showPromptPanel, setShowPromptPanel] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showShowcase, setShowShowcase] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('margin_showcase_completed_v1');
    } catch {
      return false;
    }
  });

  const handleCloseShowcase = useCallback(() => {
    setShowShowcase(false);
    try {
      localStorage.setItem('margin_showcase_completed_v1', 'true');
    } catch {
      // ignore
    }
  }, []);

  // Active Margin Note Composer
  const [activeNoteParaId, setActiveNoteParaId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  const bookStructure: BookStructure =
    customBooks[activeBookId] ||
    (activeBookId === 'bolton-2005'
      ? BOLTON_BOOK_STRUCTURE
      : OPENSTAX_BOOK_STRUCTURE);

  const defaultStoreState = useMemo<PerBookStoreState>(() => {
    if (activeBookId === 'bolton-2005') {
      const fullBolton = customBooks['bolton-2005'];
      const generated = fullBolton
        ? buildInstrumentsForBook(fullBolton)
        : { preQuestions: [], keyIdeas: [] };
      return {
        bookId: 'bolton-2005',
        lastSectionId: '4.2',
        lastPage: 137,
        lastScrollTop: 0,
        highlights: [
          {
            id: 'hl-seed-1',
            bookId: 'bolton-2005',
            sectionId: '4.2',
            paragraphId: 'p-4.2-6',
            page: 139,
            selectedText:
              'the fixed transfer t and the variance risk premium ½ η s² σ² do not depend on a',
            startOffset: 98,
            endOffset: 179,
            color: 'amber',
            note: 'Key property of CARA: no wealth effect on effort choice.',
            createdAt: '2026-10-24T12:30:00.000Z',
          },
        ],
        marginNotes: [
          {
            id: 'mn-seed-1',
            bookId: 'bolton-2005',
            sectionId: '4.2',
            paragraphId: 'p-4.2-9',
            page: 139,
            content:
              'Check limit as σ² → 0: s* → 1 (sell the firm to the agent, First-Best!).',
            createdAt: '2026-10-24T12:35:00.000Z',
            updatedAt: '2026-10-24T12:35:00.000Z',
          },
        ],
        preQuestions: [
          ...BOLTON_1_1_PRE_QUESTIONS,
          ...BOLTON_4_2_PRE_QUESTIONS,
          ...generated.preQuestions.filter(
            (p) => p.sectionId !== '1.1' && p.sectionId !== '4.2'
          ),
        ],
        keyIdeas: [
          ...BOLTON_1_1_KEY_IDEAS,
          ...BOLTON_4_2_KEY_IDEAS,
          ...generated.keyIdeas.filter(
            (k) => k.sectionId !== '1.1' && k.sectionId !== '4.2'
          ),
        ],
        recallAttempts: [],
        mapAttempts: {},
        labSpecs: { '4.2': BOLTON_4_2_LAB_SPEC } as Record<string, ExplorableLabSpec>,
        predictions: [],
        revisitQueue: INITIAL_REVISIT_QUEUE,
        selfExplanations: {},
        pinnedProject: 'my business simulator',
        transferNotes: {},
        teachBackTranscript: [
          {
            role: 'novice',
            text: 'Why wouldn’t the principal always set s = 1 so the agent keeps 100% of marginal output and works at First-Best effort?',
          },
        ],
        promptLogs: INITIAL_PROMPT_LOGS,
      };
    }

    if (activeBookId === 'openstax-econ-3e') {
      const generated = buildInstrumentsForBook(OPENSTAX_BOOK_STRUCTURE);
      return {
        bookId: 'openstax-econ-3e',
        lastSectionId: '8.2',
        lastPage: 192,
        lastScrollTop: 0,
        highlights: [],
        marginNotes: [],
        preQuestions: [
          ...OPENSTAX_8_2_PRE_QUESTIONS,
          ...generated.preQuestions.filter((p) => p.sectionId !== '8.2'),
        ],
        keyIdeas: [
          ...OPENSTAX_8_2_KEY_IDEAS,
          ...generated.keyIdeas.filter((k) => k.sectionId !== '8.2'),
        ],
        recallAttempts: [],
        mapAttempts: {},
        labSpecs: { '8.2': OPENSTAX_8_2_LAB_SPEC } as Record<string, ExplorableLabSpec>,
        predictions: [],
        revisitQueue: [],
        selfExplanations: {},
        pinnedProject: 'my business simulator',
        transferNotes: {},
        teachBackTranscript: [
          {
            role: 'novice',
            text: 'Why does a price-taking firm set P = MC(q) instead of maximizing average profit per unit?',
          },
        ],
        promptLogs: [],
      };
    }

    // Any custom uploaded book: build anchored Pre-Questions & Key Ideas for all its sections!
    const customStruct = customBooks[activeBookId] || bookStructure;
    const generated = buildInstrumentsForBook(customStruct);
    const firstSec = customStruct.sections[0];
    return {
      bookId: activeBookId,
      lastSectionId: firstSec?.id || '1.1',
      lastPage: firstSec?.startPage || 1,
      lastScrollTop: 0,
      highlights: [],
      marginNotes: [],
      preQuestions: generated.preQuestions,
      keyIdeas: generated.keyIdeas,
      recallAttempts: [],
      mapAttempts: {},
      labSpecs: {},
      predictions: [],
      revisitQueue: [],
      selfExplanations: {},
      pinnedProject: 'my business simulator',
      transferNotes: {},
      teachBackTranscript: [
        {
          role: 'novice',
          text: `In "${customStruct.title}", how would you explain the core argument of §${firstSec?.number || '1.1'} (${firstSec?.title || ''}) in simple terms?`,
        },
      ],
      promptLogs: [],
    };
  }, [activeBookId, customBooks, bookStructure]);

  const [store, setStore] = useState<PerBookStoreState>(() =>
    loadLocalBookState(activeBookId, defaultStoreState)
  );

  // Switch store when book changes
  useEffect(() => {
    setStore(loadLocalBookState(activeBookId, defaultStoreState));
  }, [activeBookId, defaultStoreState]);

  // Persist store on changes
  useEffect(() => {
    saveLocalBookState(store);
  }, [store]);

  // Sync theme attribute on document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Automatically load the full local Bolton PDF into Reader Text View when present on disk
  useEffect(() => {
    let cancelled = false;
    const autoLoadLocalBolton = async () => {
      try {
        const res = await fetch('/api/local-pdf/bolton', { method: 'HEAD' });
        if (!res.ok || cancelled) return;
        const ingested = await ingestPdfSourceClient(
          '/api/local-pdf/bolton',
          undefined,
          {
            bookId: 'bolton-2005',
            title: 'Contract Theory',
            authors: 'Patrick Bolton & Mathias Dewatripont (MIT Press, 2005)',
            mergeWithStructure: BOLTON_BOOK_STRUCTURE,
          }
        );
        if (cancelled) return;
        setCustomBooks((prev) => ({
          ...prev,
          'bolton-2005': ingested.structure,
        }));
        setStore((prev) => {
          if (prev.bookId !== 'bolton-2005') return prev;
          const existingPqIds = new Set(prev.preQuestions.map((p) => p.id));
          const existingKiIds = new Set(prev.keyIdeas.map((k) => k.id));
          return {
            ...prev,
            preQuestions: [
              ...prev.preQuestions,
              ...ingested.preQuestions.filter(
                (p) => !existingPqIds.has(p.id)
              ),
            ],
            keyIdeas: [
              ...prev.keyIdeas,
              ...ingested.keyIdeas.filter(
                (k) => !existingKiIds.has(k.id)
              ),
            ],
          };
        });
      } catch {
        // Local Bolton PDF stream is optional if user hasn't placed it in default paths
      }
    };
    autoLoadLocalBolton();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentSection =
    bookStructure.sections.find((s) => s.id === store.lastSectionId) ||
    bookStructure.sections[0];

  const currentSectionIdx = bookStructure.sections.findIndex(
    (s) => s.id === currentSection?.id
  );
  const prevSection =
    currentSectionIdx > 0
      ? bookStructure.sections[currentSectionIdx - 1]
      : undefined;
  const nextSection =
    currentSectionIdx >= 0 &&
    currentSectionIdx < bookStructure.sections.length - 1
      ? bookStructure.sections[currentSectionIdx + 1]
      : undefined;

  const selectSection = useCallback(
    (secId: string, page?: number, pdfPage?: number) => {
      const sec = bookStructure.sections.find((s) => s.id === secId);
      setStore((prev) => ({
        ...prev,
        lastSectionId: secId,
        lastPage: page || sec?.startPage || prev.lastPage,
      }));
      if (pdfPage || sec?.pdfStartPage) {
        setTargetPdfPage(pdfPage || sec?.pdfStartPage || 152);
      }
    },
    [bookStructure.sections]
  );

  // Create a highlight from a given selection
  const createHighlight = useCallback(
    (
      text: string,
      paragraphId: string,
      sectionId: string,
      page: number
    ) => {
      const clean = text.trim();
      if (clean.length < 2) return;
      const newHighlight: HighlightItem = {
        id: `hl-${Date.now()}`,
        bookId: activeBookId,
        sectionId,
        paragraphId,
        page,
        selectedText: clean,
        startOffset: 0,
        endOffset: clean.length,
        color: 'amber',
        createdAt: new Date().toISOString(),
      };
      setStore((prev) => ({
        ...prev,
        highlights: [...prev.highlights, newHighlight],
      }));
      showQuickToast('🖍 Highlight saved to margin');
    },
    [activeBookId, showQuickToast]
  );

  // Trigger highlight action via shortcut 'h' or toolbar button
  const handleHighlightAction = useCallback(() => {
    const activeSel = window.getSelection()?.toString().trim() || '';
    if (activeSel.length >= 2 && lastSelection && lastSelection.text === activeSel) {
      createHighlight(
        lastSelection.text,
        lastSelection.paragraphId,
        lastSelection.sectionId,
        lastSelection.page
      );
      window.getSelection()?.removeAllRanges();
      return;
    }
    if (activeSel.length >= 2 && currentSection) {
      const fallbackPara =
        currentSection.paragraphs[0]?.id || `p-${currentSection.id}-1`;
      createHighlight(
        activeSel,
        lastSelection?.paragraphId || fallbackPara,
        lastSelection?.sectionId || currentSection.id,
        lastSelection?.page || currentSection.startPage
      );
      window.getSelection()?.removeAllRanges();
      return;
    }
    // Otherwise toggle Highlight Tool mode on/off
    setHighlightToolActive((prev) => {
      const next = !prev;
      showQuickToast(
        next
          ? '🖍 Highlight Tool ON — select any text to highlight (& auto-copy)'
          : 'Highlight Tool OFF — selecting text auto-copies to clipboard'
      );
      return next;
    });
  }, [createHighlight, currentSection, lastSelection, showQuickToast]);

  const handleJumpToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const scroller = document.querySelector('.book-scroll-container');
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Keyboard shortcuts engine
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Always allow Escape to close open panels/modals even if inside an input
      if (e.key === 'Escape') {
        setShowShowcase(false);
        setShowShortcutsModal(false);
        setShowOptionsMenu(false);
        setShowExportModal(false);
        setShowPromptPanel(false);
        setActiveNoteParaId(null);
        if (isInput) {
          (e.target as HTMLElement)?.blur();
        }
        return;
      }

      // Do not trigger single-key navigation shortcuts while typing in inputs
      if (isInput) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // '?' -> Toggle Shortcuts cheatsheet
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal((v) => !v);
        return;
      }

      // '/' -> Focus Search
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // 'j' / 'k' -> Reader smooth scroll down / up
      if (e.key === 'j') {
        window.scrollBy({ top: 220, behavior: 'smooth' });
        document.querySelector('.book-scroll-container')?.scrollBy({ top: 220, behavior: 'smooth' });
        return;
      }
      if (e.key === 'k') {
        window.scrollBy({ top: -220, behavior: 'smooth' });
        document.querySelector('.book-scroll-container')?.scrollBy({ top: -220, behavior: 'smooth' });
        return;
      }

      // 't' -> Jump to Top
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleJumpToTop();
        return;
      }

      // 'G' (Shift+G) -> Jump to Bottom
      if (e.key === 'G') {
        e.preventDefault();
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        return;
      }

      // '[' or 'p' -> Previous section
      if ((e.key === '[' || e.key === 'p') && prevSection) {
        selectSection(
          prevSection.id,
          prevSection.startPage,
          prevSection.pdfStartPage
        );
        return;
      }

      // ']' or 'n' -> Next section
      if ((e.key === ']' || e.key === 'n') && nextSection) {
        selectSection(
          nextSection.id,
          nextSection.startPage,
          nextSection.pdfStartPage
        );
        return;
      }

      // '1', '2', '3' -> Reading View Scope
      if (e.key === '1') {
        setReadingScope('section');
        showQuickToast('Reading View: Current Section');
        return;
      }
      if (e.key === '2') {
        setReadingScope('chapter');
        showQuickToast('Reading View: Full Chapter');
        return;
      }
      if (e.key === '3') {
        setReadingScope('book');
        showQuickToast('Reading View: Whole Book');
        return;
      }

      // Drawers & Workspace Panels
      if (e.key === 'b' || e.key === 'B' || e.key === 'c' || e.key === 'C') {
        setTocOpen((o) => !o);
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        setShowStudyTools((v) => !v);
        return;
      }
      if (e.key === 'v' || e.key === 'V') {
        setShowPdfCanvas((v) => !v);
        return;
      }
      if (e.key === ',' || e.key === 'o' || e.key === 'O') {
        setShowOptionsMenu((v) => !v);
        return;
      }
      if (e.key === 'd' || e.key === 'D') {
        setTheme((t) => (t === 'light' ? 'dark' : 'light'));
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        setShowExportModal(true);
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        setShowPromptPanel(true);
        return;
      }

      // Highlighting & Annotation
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        handleHighlightAction();
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const fallbackPara = currentSection.paragraphs[0]?.id;
        if (fallbackPara) {
          setActiveNoteParaId(fallbackPara);
          showQuickToast('Adding margin note to passage...');
        }
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        setIsPageBlurred((b) => {
          const next = !b;
          showQuickToast(next ? 'Book closed (page blurred for recall)' : 'Book opened');
          return next;
        });
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleHighlightAction,
    prevSection,
    nextSection,
    selectSection,
    handleJumpToTop,
    showQuickToast,
    currentSection,
  ]);

  // Track window & container scroll to toggle Jump-to-Top button
  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const scroller = document.querySelector('.book-scroll-container');
      const containerScroll = scroller ? scroller.scrollTop : 0;
      setShowJumpToTop(scrollY > 250 || containerScroll > 250);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    const scroller = document.querySelector('.book-scroll-container');
    scroller?.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      scroller?.removeEventListener('scroll', onScroll);
    };
  }, []);

  const jumpToAnchor = (page: number, paragraphId?: string) => {
    setIsPageBlurred(false);
    setStore((prev) => ({ ...prev, lastPage: page }));
    setTargetPdfPage(page + 17);
    if (paragraphId) {
      const el = document.getElementById(paragraphId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('anchor-flash');
        setTimeout(() => el.classList.remove('anchor-flash'), 1800);
      }
    }
  };

  // Selecting text automatically copies it to clipboard; only highlights if Highlight Tool is active
  const handleParagraphMouseUp = (
    paragraphId: string,
    sectionId: string,
    page: number
  ) => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 2) return;

    // 1. Always auto-copy selected text to clipboard
    copyTextToClipboard(text);
    setLastSelection({ text, paragraphId, sectionId, page });

    // 2. If the Highlight Tool is active, also create a highlight
    if (highlightToolActive) {
      createHighlight(text, paragraphId, sectionId, page);
      sel?.removeAllRanges();
    } else {
      showQuickToast('✓ Copied to clipboard · Press H to highlight');
    }
  };

  // Pre-question guess handler
  const handleUpdatePreQuestion = (id: string, patch: Partial<PreQuestion>) => {
    setStore((prev) => {
      const exists = prev.preQuestions.some((pq) => pq.id === id);
      if (exists) {
        return {
          ...prev,
          preQuestions: prev.preQuestions.map((pq) =>
            pq.id === id ? { ...pq, ...patch } : pq
          ),
        };
      }
      const fallbackItem = sectionPreQuestions.find((pq) => pq.id === id);
      if (fallbackItem) {
        return {
          ...prev,
          preQuestions: [...prev.preQuestions, { ...fallbackItem, ...patch }],
        };
      }
      return prev;
    });
  };

  // Free recall save + update Spaced Revisit Queue
  const handleSaveRecallAttempt = (
    attempt: FreeRecallAttempt,
    gapCount: number
  ) => {
    setStore((prev) => {
      const existingRev = prev.revisitQueue.find(
        (r) => r.sectionId === currentSection.id
      );
      const unansweredCount = prev.preQuestions.filter(
        (pq) => pq.sectionId === currentSection.id && !pq.readerGuess
      ).length;
      const updatedRev = buildOrUpdateRevisitItem(
        {
          bookId: activeBookId,
          sectionId: currentSection.id,
          chapterId: currentSection.chapterId,
          sectionTitle: currentSection.title,
          gapCount,
          unansweredPromptsCount: unansweredCount,
        },
        existingRev
      );

      const nextQueue = existingRev
        ? prev.revisitQueue.map((r) =>
            r.id === existingRev.id ? updatedRev : r
          )
        : [...prev.revisitQueue, updatedRev];

      const logEntry: PromptLogEntry = {
        id: `plog-${Date.now()}`,
        timestamp: new Date().toISOString(),
        method: 'free_recall_check',
        sectionId: currentSection.id,
        model: 'claude-sonnet-4-20250514',
        systemPrompt:
          'Compare the reader’s free-recall attempt against the section’s anchored key ideas. Mark coverage (covered / partial / gap) without grading prose.',
        userPrompt: `Section §${currentSection.id} | Reader recall (${attempt.readerText.length} chars): "${attempt.readerText.slice(0, 180)}..."`,
        sectionExcerptCharCount: 2850,
        status: 'completed',
        responseSummary: `Marked ${attempt.coverage.filter((c) => c.status === 'covered').length} covered, ${gapCount} gaps; scheduled revisit in ${updatedRev.intervalDays}d.`,
      };

      return {
        ...prev,
        recallAttempts: [...prev.recallAttempts, attempt],
        revisitQueue: nextQueue,
        promptLogs: [logEntry, ...prev.promptLogs],
      };
    });
  };

  // Upload any local PDF file, run client-side PDF.js full-book structure & body extraction, and keep Reader Text View active
  const handlePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedPdfFile(file);
    setIngestionStatus(
      `Ingesting "${file.name}" — extracting full book text, TOC, sections, and study instruments...`
    );

    try {
      const result = await ingestPdfFileClient(file, (msg) =>
        setIngestionStatus(msg)
      );
      const { structure: newStruct, preQuestions, keyIdeas, referenceMap } =
        result;
      const firstSec = newStruct.sections[0];

      try {
        localStorage.removeItem(`margin_book_store_v2_${newStruct.bookId}`);
      } catch {
        // ignore
      }

      setCustomBooks((prev) => ({ ...prev, [newStruct.bookId]: newStruct }));
      setCustomMaps((prev) => ({ ...prev, [newStruct.bookId]: referenceMap }));
      setActiveBookId(newStruct.bookId);
      setTargetPdfPage(firstSec?.pdfStartPage || 1);

      setStore({
        bookId: newStruct.bookId,
        lastSectionId: firstSec?.id || '1',
        lastPage: firstSec?.startPage || 1,
        lastScrollTop: 0,
        highlights: [],
        marginNotes: [],
        preQuestions,
        keyIdeas,
        recallAttempts: [],
        mapAttempts: {},
        labSpecs: {},
        predictions: [],
        revisitQueue: [],
        selfExplanations: {},
        pinnedProject: 'my business simulator',
        transferNotes: {},
        teachBackTranscript: [
          {
            role: 'novice',
            text: `In "${newStruct.title}", how would you explain the core argument of §${firstSec?.number || '1.1'} (${firstSec?.title || ''}) in simple terms?`,
          },
        ],
        promptLogs: [],
      });

      setIngestionStatus(
        `Ingested "${file.name}" (${newStruct.sections.length} sections across ${newStruct.totalPages} pages). Reading in Text View — click "📄 PDF.js Page View" anytime to see the PDF.`
      );
      setTimeout(() => setIngestionStatus(null), 4500);
    } catch (err) {
      setIngestionStatus(
        `Error parsing PDF structure: ${(err as Error).message}`
      );
      setTimeout(() => setIngestionStatus(null), 5000);
    }
  };

  // Determine which sections are rendered in the main Reader sheet based on readingScope
  const displayedSections: BookSection[] = useMemo(() => {
    if (!currentSection) return [];
    if (readingScope === 'book') {
      return bookStructure.sections;
    }
    if (readingScope === 'chapter') {
      const chapSecs = bookStructure.sections.filter(
        (s) => s.chapterId === currentSection.chapterId
      );
      return chapSecs.length > 0 ? chapSecs : [currentSection];
    }
    return [currentSection];
  }, [bookStructure.sections, currentSection, readingScope]);

  const sectionPreQuestions = useMemo(() => {
    const existing = store.preQuestions.filter(
      (pq) => pq.sectionId === currentSection.id && !pq.deletedByReader
    );
    if (existing.length > 0) return existing;
    return generateDefaultPreQuestions(bookStructure.bookId, currentSection);
  }, [store.preQuestions, currentSection, bookStructure.bookId]);
  const sectionKeyIdeas = store.keyIdeas.filter(
    (ki) => ki.sectionId === currentSection.id
  );
  const sectionLabSpec = store.labSpecs[currentSection.id];
  const exportData = useMemo(
    () => buildReaderExport(bookStructure.title, store),
    [bookStructure.title, store]
  );

  return (
    <div className="margin-app-shell">
      {/* Top Reader Bar — Minimal, calm, and focused on reading & margin notes */}
      <header className="reader-topbar">
        <div className="topbar-left">
          <button
            type="button"
            className={`btn-quiet ${tocOpen ? 'active-toggle' : ''}`}
            onClick={() => setTocOpen((o) => !o)}
            title="Toggle Table of Contents & Book Navigation (Shortcut: B)"
          >
            ☰ Contents
          </button>
          <span className="brand-mark">Margin</span>
          <span className="topbar-book-breadcrumb" title={bookStructure.title}>
            {bookStructure.title}
          </span>
          <span className="reading-pos-pill" title="Current section & book page">
            §{currentSection.number} · p. {store.lastPage}
          </span>
        </div>

        <div className="topbar-center">
          <div className="topbar-section-pager">
            <button
              type="button"
              className="btn-quiet"
              disabled={!prevSection}
              onClick={() =>
                prevSection &&
                selectSection(
                  prevSection.id,
                  prevSection.startPage,
                  prevSection.pdfStartPage
                )
              }
              title="Previous section (Shortcut: [)"
            >
              ← Prev
            </button>
            <span className="pager-current-label" title={currentSection.title}>
              §{currentSection.number}
            </span>
            <button
              type="button"
              className="btn-quiet"
              disabled={!nextSection}
              onClick={() =>
                nextSection &&
                selectSection(
                  nextSection.id,
                  nextSection.startPage,
                  nextSection.pdfStartPage
                )
              }
              title="Next section (Shortcut: ])"
            >
              Next →
            </button>
          </div>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className={`btn-quiet ${highlightToolActive ? 'active-toggle' : ''}`}
            onClick={handleHighlightAction}
            title="Highlight selected text or toggle Highlight Tool (Shortcut: H)"
          >
            🖍 Highlight (H)
          </button>
          <button
            type="button"
            className={`btn-quiet ${showPdfCanvas ? 'active-toggle' : ''}`}
            onClick={() => setShowPdfCanvas((v) => !v)}
            title="Toggle optional PDF page view"
          >
            {showPdfCanvas ? '📖 Hide PDF' : '📄 PDF View'}
          </button>
          <button
            type="button"
            className={`btn-quiet ${showStudyTools ? 'active-toggle' : ''}`}
            onClick={() => setShowStudyTools((v) => !v)}
            title="Show or hide Pre-Questions, Free Recall, Concept Map & Lab"
          >
            🧪 Study Tools
          </button>
          <button
            type="button"
            className="btn-quiet showcase-trigger-btn"
            onClick={() => setShowShowcase(true)}
            title="Feature Tour & Flow Walkthrough"
          >
            ✨ Tour
          </button>
          <button
            type="button"
            className={`btn-quiet ${showOptionsMenu ? 'active-toggle' : ''}`}
            onClick={() => setShowOptionsMenu((v) => !v)}
            title="Settings, Reading Scope, Library & Search"
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      {/* Settings & Reading Workspace Slide-Over Drawer */}
      {showOptionsMenu && (
        <div
          className="settings-drawer-backdrop"
          onClick={() => setShowOptionsMenu(false)}
        >
          <aside
            className="settings-drawer-panel"
            role="dialog"
            aria-label="Settings & Library"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-drawer-header">
              <div>
                <h2>Settings & Preferences</h2>
                <p>Customize your reading view, active library, and study data.</p>
              </div>
              <button
                type="button"
                className="btn-quiet"
                onClick={() => setShowOptionsMenu(false)}
                title="Close Settings (Escape)"
              >
                ×
              </button>
            </div>

            <div className="settings-drawer-content">
              {/* Section 1: Reading View Mode */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <span className="settings-card-icon">📖</span>
                  <div>
                    <h3>Reading Scope</h3>
                    <p>Choose how much content is displayed on your reading page.</p>
                  </div>
                </div>
                <div className="settings-scope-grid">
                  <button
                    type="button"
                    className={`settings-scope-option ${readingScope === 'section' ? 'selected' : ''}`}
                    onClick={() => setReadingScope('section')}
                  >
                    <strong>Section View</strong>
                    <span>Focus on §{currentSection.number} with section study instruments.</span>
                  </button>
                  <button
                    type="button"
                    className={`settings-scope-option ${readingScope === 'chapter' ? 'selected' : ''}`}
                    onClick={() => setReadingScope('chapter')}
                  >
                    <strong>Chapter View</strong>
                    <span>Read all sections of Chapter {currentSection.chapterId} continuously.</span>
                  </button>
                  <button
                    type="button"
                    className={`settings-scope-option ${readingScope === 'book' ? 'selected' : ''}`}
                    onClick={() => setReadingScope('book')}
                  >
                    <strong>Whole Book</strong>
                    <span>Continuous manuscript reading across all {bookStructure.sections.length} sections.</span>
                  </button>
                </div>
              </div>

              {/* Section 2: Library & Local PDF */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <span className="settings-card-icon">📚</span>
                  <div>
                    <h3>Library & Source Document</h3>
                    <p>Switch between books or open your own PDF file.</p>
                  </div>
                </div>
                <div className="settings-card-body">
                  <label className="settings-input-label">Active Book:</label>
                  <select
                    className="book-selector settings-book-select"
                    value={activeBookId}
                    onChange={(e) => {
                      setActiveBookId(e.target.value);
                    }}
                    aria-label="Select Book"
                  >
                    <option value="bolton-2005">
                      Bolton & Dewatripont — Contract Theory (
                      {customBooks['bolton-2005']
                        ? `${customBooks['bolton-2005'].sections.length} sections`
                        : 'Ch. 4, §4.2'}
                      )
                    </option>
                    <option value="openstax-econ-3e">
                      OpenStax — Principles of Economics 3e
                    </option>
                    {Object.values(customBooks)
                      .filter((cb) => cb.bookId !== 'bolton-2005')
                      .map((cb) => (
                        <option key={cb.bookId} value={cb.bookId}>
                          📄 {cb.title} ({cb.sections.length} sections)
                        </option>
                      ))}
                  </select>

                  <label className="btn-quiet file-upload-label settings-upload-btn">
                    <span>📂 Open Local PDF File…</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        setShowOptionsMenu(false);
                        handlePdfFileSelect(e);
                      }}
                      hidden
                    />
                  </label>
                  <small className="settings-hint">
                    Extracts full text, Table of Contents, equations, and generates section study tools.
                  </small>
                </div>
              </div>

              {/* Section 3: Search in Book */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <span className="settings-card-icon">🔍</span>
                  <div>
                    <h3>Search in Document</h3>
                    <p>Filter text, equations, and definitions in the current view.</p>
                  </div>
                </div>
                <div className="settings-search-row">
                  <input
                    ref={searchInputRef}
                    type="search"
                    className="reader-search-input settings-search-input"
                    placeholder="Search keywords or equations (press /)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="btn-quiet"
                      onClick={() => setSearchQuery('')}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Section 4: Workspace Appearance & Data */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <span className="settings-card-icon">🎨</span>
                  <div>
                    <h3>Appearance & Study Data</h3>
                    <p>Theme preferences, notes export, and prompt transparency.</p>
                  </div>
                </div>
                <div className="settings-actions-grid">
                  <button
                    type="button"
                    className="btn-quiet settings-action-tile"
                    onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                  >
                    <span className="action-tile-icon">{theme === 'light' ? '☾' : '☀'}</span>
                    <div>
                      <strong>Theme</strong>
                      <small>{theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="btn-quiet settings-action-tile"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      setShowExportModal(true);
                    }}
                  >
                    <span className="action-tile-icon">📥</span>
                    <div>
                      <strong>Export My Work</strong>
                      <small>Markdown & JSON (Privacy-safe)</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="btn-quiet settings-action-tile"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      setShowPromptPanel(true);
                    }}
                  >
                    <span className="action-tile-icon">🤖</span>
                    <div>
                      <strong>AI Transparency</strong>
                      <small>{store.promptLogs.length} prompt logs recorded</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="btn-quiet settings-action-tile"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      setShowShortcutsModal(true);
                    }}
                  >
                    <span className="action-tile-icon">⌨</span>
                    <div>
                      <strong>Keyboard Shortcuts</strong>
                      <small>Press ? anytime to view shortcuts</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="btn-quiet settings-action-tile"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      setShowShowcase(true);
                    }}
                  >
                    <span className="action-tile-icon">✨</span>
                    <div>
                      <strong>Feature Tour & Flow Walkthrough</strong>
                      <small>Review all 5 study methods & reader capabilities</small>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Auto-copy / Highlight status toast */}
      {selectionToast && (
        <div className="selection-toast-pill" role="status">
          <span>{selectionToast}</span>
          {!highlightToolActive && lastSelection && (
            <button
              type="button"
              className="btn-toast-highlight"
              onClick={() => {
                createHighlight(
                  lastSelection.text,
                  lastSelection.paragraphId,
                  lastSelection.sectionId,
                  lastSelection.page
                );
                window.getSelection()?.removeAllRanges();
              }}
            >
              🖍 Highlight Now (H)
            </button>
          )}
        </div>
      )}

      {/* Ingestion progress toast */}
      {ingestionStatus && (
        <div className="ingestion-progress-bar" role="status">
          <span>⚙️ {ingestionStatus}</span>
        </div>
      )}

      {/* "What the AI was asked" Transparency Panel */}
      {showPromptPanel && (
        <aside className="prompt-log-drawer" aria-label="What the AI was asked">
          <div className="drawer-header">
            <div>
              <strong>What the AI Was Asked — Prompt Transparency Log</strong>
              <p>
                Only the current section excerpt is ever sent to Claude (never the whole book).
                API key is read from <code>ANTHROPIC_API_KEY</code> in the sidecar and never logged.
              </p>
            </div>
            <button
              type="button"
              className="btn-quiet"
              onClick={() => setShowPromptPanel(false)}
            >
              Close ×
            </button>
          </div>
          <div className="prompt-log-list">
            {store.promptLogs.map((log) => (
              <div key={log.id} className="prompt-log-card">
                <div className="prompt-log-meta">
                  <span className="instrument-badge">{log.method}</span>
                  <span>Section §{log.sectionId}</span>
                  <span>Model: <code>{log.model}</code></span>
                  <span>Excerpt sent: {log.sectionExcerptCharCount} chars</span>
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="prompt-log-code">
                  <strong>System:</strong> {log.systemPrompt}
                  <br />
                  <strong>User Prompt:</strong> {log.userPrompt}
                </div>
                {log.responseSummary && (
                  <div className="prompt-log-summary">
                    <strong>Result:</strong> {log.responseSummary}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Privacy- & Copyright-Compliant Export Modal */}
      {showExportModal && (
        <div className="modal-backdrop" role="dialog" aria-label="Export Reader Work">
          <div className="modal-card">
            <div className="drawer-header">
              <div>
                <strong>Export Everything You Created (Markdown + JSON)</strong>
                <p>
                  Hard Copyright Rule: Exports contain only your guesses, recall attempts,
                  maps, predictions, and notes with short page anchors—never the book’s text.
                </p>
              </div>
              <button
                type="button"
                className="btn-quiet"
                onClick={() => setShowExportModal(false)}
              >
                Close ×
              </button>
            </div>
            <div className="export-columns">
              <div>
                <h4>Markdown Export</h4>
                <textarea readOnly rows={14} value={exportData.markdown} />
              </div>
              <div>
                <h4>JSON Export</h4>
                <textarea readOnly rows={14} value={exportData.json} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Dialog */}
      {showShortcutsModal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-label="Keyboard Shortcuts"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="modal-card shortcuts-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <strong>⌨ Keyboard Shortcuts</strong>
                <p>Read, navigate, and study without leaving your keyboard.</p>
              </div>
              <button
                type="button"
                className="btn-quiet"
                onClick={() => setShowShortcutsModal(false)}
              >
                Close (Esc) ×
              </button>
            </div>

            <div className="shortcuts-grid">
              <div className="shortcuts-group">
                <h4>Reading & Navigation</h4>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>[</kbd> or <kbd>P</kbd></span>
                  <span className="shortcut-desc">Previous section</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>]</kbd> or <kbd>N</kbd></span>
                  <span className="shortcut-desc">Next section</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>J</kbd> / <kbd>K</kbd></span>
                  <span className="shortcut-desc">Scroll down / up</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>T</kbd></span>
                  <span className="shortcut-desc">Jump to top</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>Shift</kbd> + <kbd>G</kbd></span>
                  <span className="shortcut-desc">Jump to bottom</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd></span>
                  <span className="shortcut-desc">Section / Chapter / Book view</span>
                </div>
              </div>

              <div className="shortcuts-group">
                <h4>Annotation & Study</h4>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>H</kbd></span>
                  <span className="shortcut-desc">Highlight selection / toggle tool</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>M</kbd></span>
                  <span className="shortcut-desc">Add margin note</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>S</kbd></span>
                  <span className="shortcut-desc">Toggle study tools (Recall, Map, Lab)</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>F</kbd></span>
                  <span className="shortcut-desc">Close book (Blur page for recall)</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>V</kbd></span>
                  <span className="shortcut-desc">Toggle PDF page view</span>
                </div>
              </div>

              <div className="shortcuts-group">
                <h4>Panels & Utilities</h4>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>B</kbd> or <kbd>C</kbd></span>
                  <span className="shortcut-desc">Toggle Contents sidebar</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>/</kbd></span>
                  <span className="shortcut-desc">Search text & equations</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>,</kbd> or <kbd>O</kbd></span>
                  <span className="shortcut-desc">Settings & Preferences</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>D</kbd></span>
                  <span className="shortcut-desc">Toggle Dark / Light theme</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>E</kbd></span>
                  <span className="shortcut-desc">Export my work</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>A</kbd></span>
                  <span className="shortcut-desc">AI prompt transparency log</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>?</kbd></span>
                  <span className="shortcut-desc">Keyboard shortcuts cheatsheet</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>Esc</kbd></span>
                  <span className="shortcut-desc">Close any open panel</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Showcase & Flow Walkthrough Modal */}
      <ShowcaseModal
        isOpen={showShowcase}
        onClose={handleCloseShowcase}
        onJumpToSection={(secId) => selectSection(secId)}
        onOpenShortcuts={() => setShowShortcutsModal(true)}
      />

      {/* Main Workspace: Collapsible TOC Sidebar + Centered Book Page + Right Margin Column */}
      <div className="reader-workspace">
        {/* Table of Contents & Navigation Sidebar */}
        {tocOpen && (
          <nav className="toc-sidebar" aria-label="Table of Contents">
            <div className="toc-book-meta">
              <div className="toc-meta-header-row">
                <h2>{bookStructure.title}</h2>
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => setTocOpen(false)}
                  title="Close Contents (Shortcut: B)"
                >
                  ×
                </button>
              </div>
              <p>{bookStructure.authors}</p>
              <div className="toc-controls-stack">
                <div className="options-segmented-row">
                  <button
                    type="button"
                    className={`btn-quiet ${readingScope === 'section' ? 'active-toggle' : ''}`}
                    onClick={() => setReadingScope('section')}
                  >
                    Section
                  </button>
                  <button
                    type="button"
                    className={`btn-quiet ${readingScope === 'chapter' ? 'active-toggle' : ''}`}
                    onClick={() => setReadingScope('chapter')}
                  >
                    Chapter
                  </button>
                  <button
                    type="button"
                    className={`btn-quiet ${readingScope === 'book' ? 'active-toggle' : ''}`}
                    onClick={() => setReadingScope('book')}
                  >
                    Whole Book
                  </button>
                </div>
                <input
                  type="search"
                  className="reader-search-input"
                  placeholder="Filter text or equations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <ul className="toc-list">
              {bookStructure.toc.map((entry) => {
                // Match exact section ID (including Chapter intro "1", "2", "4") or first child section
                const exactSec = bookStructure.sections.find(
                  (s) => s.id === entry.number
                );
                const childSec = !exactSec
                  ? bookStructure.sections.find(
                      (s) =>
                        s.chapterId === entry.number ||
                        s.id.startsWith(`${entry.number}.`)
                    )
                  : undefined;
                const targetSec = exactSec || childSec;
                const isActive =
                  currentSection.id === entry.number ||
                  (entry.level === 1 &&
                    currentSection.id === entry.number);
                return (
                  <li
                    key={entry.id}
                    className={`toc-item level-${entry.level} ${
                      isActive ? 'toc-active' : ''
                    } ${targetSec ? 'toc-clickable' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (targetSec) {
                          selectSection(
                            targetSec.id,
                            targetSec.startPage,
                            targetSec.pdfStartPage || entry.pdfPage
                          );
                        } else if (entry.pdfPage || entry.page) {
                          setTargetPdfPage(entry.pdfPage || entry.page);
                        }
                      }}
                    >
                      <span className="toc-num">{entry.number}</span>
                      <span className="toc-title">{entry.title}</span>
                      <span className="toc-page">{entry.page}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {/* Center + Right Margin Scroll Area */}
        <main
          className="book-scroll-container"
          onClick={() => {
            if (showOptionsMenu) setShowOptionsMenu(false);
          }}
        >
          {/* Optional PDF.js Canvas View of the User's Local PDF */}
          {showPdfCanvas && (
            <PdfCanvasViewer
              pdfSource={uploadedPdfFile || '/api/local-pdf/bolton'}
              targetPdfPage={targetPdfPage}
              onPageChange={(pg) =>
                setStore((prev) => ({
                  ...prev,
                  lastPage: Math.max(1, pg - 17),
                }))
              }
              onTextSelected={(selText, pdfPg) => {
                copyTextToClipboard(selText);
                const bookPg = Math.max(1, pdfPg - 17);
                const pId = currentSection.paragraphs[0]?.id || 'p-pdf';
                setLastSelection({
                  text: selText,
                  paragraphId: pId,
                  sectionId: currentSection.id,
                  page: bookPg,
                });
                if (highlightToolActive) {
                  createHighlight(selText, pId, currentSection.id, bookPg);
                } else {
                  showQuickToast('✓ Copied from PDF · Press H to highlight');
                }
              }}
            />
          )}

          {/* Collapsible Pre-Questions Banner (only shown when Study Tools is toggled open) */}
          {showStudyTools && (
            <section className="prequestions-banner" aria-label="Section Pre-Questions">
              <div className="prequestions-header">
                <div>
                  <span className="instrument-badge">
                    Pre-Questions · Guess Before Reading §{currentSection.number}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => setShowStudyTools(false)}
                >
                  Hide Study Tools ×
                </button>
              </div>

              <div className="prequestions-list">
                {sectionPreQuestions.map((pq, idx) => (
                  <div key={pq.id} className="prequestion-item">
                    <div className="pq-top-line">
                      <span className="pq-number">Q{idx + 1}.</span>
                      <p className="pq-text">{pq.question}</p>
                      <button
                        type="button"
                        className="anchor-pill"
                        onClick={() =>
                          jumpToAnchor(pq.anchor.page, pq.targetParagraphId)
                        }
                        title="Anchored passage where your guess resurfaces"
                      >
                        p. {pq.anchor.page}
                      </button>
                    </div>
                    <div className="pq-guess-row">
                      <input
                        type="text"
                        placeholder="Type a 1-line guess before reading..."
                        value={pq.readerGuess || ''}
                        onChange={(e) =>
                          handleUpdatePreQuestion(pq.id, {
                            readerGuess: e.target.value,
                            guessedAt: new Date().toISOString(),
                          })
                        }
                      />
                      {pq.readerGuess && (
                        <span className="pq-saved-indicator">
                          ✓ Anchored to p. {pq.anchor.page}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ================================================================
              THE BOOK PAGE + QUIET RIGHT MARGIN
              Continuous scroll, crisp serif typography, LaTeX equations,
              PDF-cropped figures/charts, highlights, and margin notes.
             ================================================================ */}
          <article
            className={`book-page-sheet ${
              isPageBlurred ? 'book-page-blurred' : ''
            } ${highlightToolActive ? 'highlight-tool-cursor' : ''}`}
            aria-label={`Section ${currentSection.number} Text`}
          >
            {displayedSections.map((sec) => {
              const secParagraphs = searchQuery.trim()
                ? sec.paragraphs.filter((p) => {
                    const q = searchQuery.toLowerCase();
                    return (
                      p.text.toLowerCase().includes(q) ||
                      (p.latex && p.latex.toLowerCase().includes(q))
                    );
                  })
                : sec.paragraphs;

              if (searchQuery.trim() && secParagraphs.length === 0) {
                return null;
              }

              const secPqs = store.preQuestions.filter(
                (pq) => pq.sectionId === sec.id && !pq.deletedByReader
              );

              return (
                <div key={sec.id} className="book-section-block">
                  <header className="book-section-heading">
                    <div className="section-running-head">
                      <span>
                        {sec.chapterId === '0'
                          ? 'Front Matter'
                          : `Chapter ${sec.chapterId}`}
                      </span>
                      <span>
                        Pages {sec.startPage}–{sec.endPage}
                      </span>
                    </div>
                    <h1>
                      {sec.number !== sec.title && (
                        <span className="sec-num">{sec.number}</span>
                      )}{' '}
                      {sec.title}
                    </h1>
                  </header>

                  <div className="book-paragraphs-flow">
                    {secParagraphs.map((para) => {
                      const resurfacedPqs = secPqs.filter(
                        (pq) =>
                          pq.targetParagraphId === para.id &&
                          (Boolean(pq.readerGuess) || showStudyTools)
                      );
                      const paraHighlights = store.highlights.filter(
                        (h) => h.paragraphId === para.id
                      );
                      const paraNotes = store.marginNotes.filter(
                        (n) => n.paragraphId === para.id
                      );
                      const selfExpPrompts =
                        showStudyTools && activeBookId === 'bolton-2005'
                          ? BOLTON_4_2_SELF_EXPLANATIONS.filter(
                              (se) => se.paragraphId === para.id
                            )
                          : [];

                      return (
                        <div
                          key={para.id}
                          id={para.id}
                          className={`paragraph-with-margin kind-${para.kind}`}
                        >
                          {/* Center Book Column */}
                          <div
                            className="book-prose-col"
                            onMouseUp={() =>
                              handleParagraphMouseUp(para.id, sec.id, para.page)
                            }
                          >
                            <span
                              className="page-gutter-num"
                              title={`Book page ${para.page}`}
                            >
                              p.{para.page}
                            </span>

                            {para.kind === 'figure' && para.pdfCrop ? (
                              <PdfRegionCrop
                                pdfSource={
                                  uploadedPdfFile || '/api/local-pdf/bolton'
                                }
                                crop={para.pdfCrop}
                                kind="figure"
                                onOpenPdfPage={(pdfPg) => {
                                  setTargetPdfPage(pdfPg);
                                  setShowPdfCanvas(true);
                                }}
                              />
                            ) : para.kind === 'equation' && para.latex ? (
                              <div className="book-equation-block">
                                <div className="eq-caption">{para.text}</div>
                                <div className="eq-math-row">
                                  <div
                                    className="katex-display-wrap"
                                    dangerouslySetInnerHTML={{
                                      __html: katex.renderToString(para.latex, {
                                        displayMode: true,
                                        throwOnError: false,
                                      }),
                                    }}
                                  />
                                  {para.equationLabel && (
                                    <span className="eq-label-num">
                                      {para.equationLabel}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : para.kind === 'equation' && para.pdfCrop ? (
                              <PdfRegionCrop
                                pdfSource={
                                  uploadedPdfFile || '/api/local-pdf/bolton'
                                }
                                crop={para.pdfCrop}
                                kind="equation"
                              />
                            ) : para.kind === 'table' && para.tableData ? (
                              <DataToChartBlock table={para.tableData} />
                            ) : (
                              <p className="book-paragraph-text">
                                {renderParagraphWithHighlights(
                                  para.text,
                                  paraHighlights
                                )}
                              </p>
                            )}

                            {/* Subtle "+ Note" action on hover */}
                            <div className="paragraph-hover-tools">
                              <button
                                type="button"
                                className="btn-margin-note-trigger"
                                onClick={() => {
                                  setActiveNoteParaId(
                                    activeNoteParaId === para.id ? null : para.id
                                  );
                                  setNoteDraft('');
                                }}
                              >
                                + Note
                              </button>
                            </div>
                          </div>

                          {/* Right Margin Column — Quiet unless there is a highlight, note, or active study prompt */}
                          <aside className="book-margin-col">
                            {/* Resurfaced Pre-Question Guess (Method 1) */}
                            {resurfacedPqs.map((pq) => (
                              <div
                                key={pq.id}
                                className={`margin-resurfaced-guess ${
                                  pq.readerGuess ? 'has-guess' : 'awaiting-guess'
                                }`}
                              >
                                <div className="margin-card-top">
                                  <span className="stub-pill">
                                    Pre-Question Guess · p.{para.page}
                                  </span>
                                </div>
                                <p className="margin-pq-question">{pq.question}</p>
                                {pq.readerGuess ? (
                                  <div className="margin-your-guess">
                                    <strong>Your Guess:</strong>
                                    <p>“{pq.readerGuess}”</p>
                                  </div>
                                ) : (
                                  <p className="margin-no-guess">
                                    <em>
                                      Add a guess in Pre-Questions above to compare alongside this passage.
                                    </em>
                                  </p>
                                )}
                              </div>
                            ))}

                            {/* Method 4: Self-Explanation Prompt at Derivations & Equations */}
                            {selfExpPrompts.map((se) => (
                              <SelfExplanationMarginCard
                                key={se.id}
                                prompt={se}
                                savedAnswer={store.selfExplanations[se.id]}
                                onSaveAnswer={(pid, ans) =>
                                  setStore((prev) => ({
                                    ...prev,
                                    selfExplanations: {
                                      ...prev.selfExplanations,
                                      [pid]: ans,
                                    },
                                  }))
                                }
                              />
                            ))}

                            {/* Reader Highlights on this Paragraph */}
                            {paraHighlights.map((hl) => (
                              <div key={hl.id} className="margin-highlight-card">
                                <div className="margin-card-top">
                                  <span className="hl-marker">
                                    Highlight · p.{hl.page}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn-dismiss"
                                    onClick={() =>
                                      setStore((prev) => ({
                                        ...prev,
                                        highlights: prev.highlights.filter(
                                          (item) => item.id !== hl.id
                                        ),
                                      }))
                                    }
                                  >
                                    ×
                                  </button>
                                </div>
                                <blockquote>“{hl.selectedText}”</blockquote>
                                {hl.note && <p className="hl-note">{hl.note}</p>}
                              </div>
                            ))}

                            {/* Reader Margin Notes on this Paragraph */}
                            {paraNotes.map((mn) => (
                              <div key={mn.id} className="margin-note-card">
                                <div className="margin-card-top">
                                  <span>Note · p.{mn.page}</span>
                                  <button
                                    type="button"
                                    className="btn-dismiss"
                                    onClick={() =>
                                      setStore((prev) => ({
                                        ...prev,
                                        marginNotes: prev.marginNotes.filter(
                                          (item) => item.id !== mn.id
                                        ),
                                      }))
                                    }
                                  >
                                    ×
                                  </button>
                                </div>
                                <p>{mn.content}</p>
                              </div>
                            ))}

                            {/* Composer for a new Margin Note */}
                            {activeNoteParaId === para.id && (
                              <div className="margin-note-composer">
                                <textarea
                                  rows={2}
                                  placeholder="Write a margin note..."
                                  value={noteDraft}
                                  onChange={(e) => setNoteDraft(e.target.value)}
                                />
                                <div className="margin-card-actions">
                                  <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => {
                                      if (!noteDraft.trim()) return;
                                      const created: MarginNote = {
                                        id: `mn-${Date.now()}`,
                                        bookId: activeBookId,
                                        sectionId: sec.id,
                                        paragraphId: para.id,
                                        page: para.page,
                                        content: noteDraft.trim(),
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString(),
                                      };
                                      setStore((prev) => ({
                                        ...prev,
                                        marginNotes: [
                                          ...prev.marginNotes,
                                          created,
                                        ],
                                      }));
                                      setActiveNoteParaId(null);
                                      setNoteDraft('');
                                    }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-quiet"
                                    onClick={() => setActiveNoteParaId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </aside>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Bottom Section Navigation + Quiet Study Tools Trigger */}
            <footer className="section-bottom-nav">
              <div className="section-bottom-pager">
                {prevSection ? (
                  <button
                    type="button"
                    className="btn-quiet"
                    onClick={() => {
                      selectSection(
                        prevSection.id,
                        prevSection.startPage,
                        prevSection.pdfStartPage
                      );
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    ← §{prevSection.number} {prevSection.title}
                  </button>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  className={`btn-quiet ${showStudyTools ? 'active-toggle' : ''}`}
                  onClick={() => setShowStudyTools((v) => !v)}
                >
                  {showStudyTools
                    ? 'Hide Section Study Tools ▴'
                    : '🧪 Open Section Study Tools (Recall, Map, Lab) ▾'}
                </button>

                {nextSection ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      selectSection(
                        nextSection.id,
                        nextSection.startPage,
                        nextSection.pdfStartPage
                      );
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Next: §{nextSection.number} {nextSection.title} →
                  </button>
                ) : (
                  <span />
                )}
              </div>
            </footer>
          </article>

          {/* ================================================================
              COLLAPSIBLE STUDY TOOLS DRAWER (Hidden until clicked)
              Organized into clean tabs so only 1 tool is shown at a time.
             ================================================================ */}
          {showStudyTools && (
            <div className="between-sections-instruments">
              <div className="study-tools-tabbar" role="tablist">
                <button
                  type="button"
                  className={`btn-quiet ${activeStudyTab === 'recall' ? 'active-toggle' : ''}`}
                  onClick={() => setActiveStudyTab('recall')}
                >
                  1. Free Recall
                </button>
                <button
                  type="button"
                  className={`btn-quiet ${activeStudyTab === 'map' ? 'active-toggle' : ''}`}
                  onClick={() => setActiveStudyTab('map')}
                >
                  2. Concept Map
                </button>
                {sectionLabSpec && (
                  <button
                    type="button"
                    className={`btn-quiet ${activeStudyTab === 'lab' ? 'active-toggle' : ''}`}
                    onClick={() => setActiveStudyTab('lab')}
                  >
                    3. Interactive Model Lab
                  </button>
                )}
                <button
                  type="button"
                  className={`btn-quiet ${activeStudyTab === 'more' ? 'active-toggle' : ''}`}
                  onClick={() => setActiveStudyTab('more')}
                >
                  4. Teach-Back & Spaced Revisit
                </button>
              </div>

              {activeStudyTab === 'lab' && sectionLabSpec && (
                <ExplorableLab
                  key={sectionLabSpec.id}
                  spec={sectionLabSpec}
                  predictions={store.predictions.filter(
                    (p) => p.labId === sectionLabSpec.id
                  )}
                  onRecordPrediction={(pred: SliderPrediction) =>
                    setStore((prev) => ({
                      ...prev,
                      predictions: [...prev.predictions, pred],
                    }))
                  }
                  onUpdateSpec={(updated) =>
                    setStore((prev) => ({
                      ...prev,
                      labSpecs: { ...prev.labSpecs, [currentSection.id]: updated },
                    }))
                  }
                  onJumpToAnchor={jumpToAnchor}
                />
              )}

              {activeStudyTab === 'recall' && (
                <FreeRecallPanel
                  key={`recall-${activeBookId}-${currentSection.id}`}
                  bookId={activeBookId}
                  sectionId={currentSection.id}
                  sectionTitle={currentSection.title}
                  keyIdeas={sectionKeyIdeas}
                  attempts={store.recallAttempts.filter(
                    (a) => a.sectionId === currentSection.id
                  )}
                  isPageBlurred={isPageBlurred}
                  onTogglePageBlur={setIsPageBlurred}
                  onSaveAttempt={handleSaveRecallAttempt}
                  onUpdateKeyIdeas={(ideas: SectionKeyIdea[]) =>
                    setStore((prev) => ({
                      ...prev,
                      keyIdeas: [
                        ...prev.keyIdeas.filter(
                          (k) => k.sectionId !== currentSection.id
                        ),
                        ...ideas,
                      ],
                    }))
                  }
                  onJumpToAnchor={jumpToAnchor}
                />
              )}

              {activeStudyTab === 'map' && (
                <RetrievalMapCanvas
                  key={`map-${activeBookId}-${currentSection.chapterId}`}
                  bookId={activeBookId}
                  chapterId={currentSection.chapterId}
                  referenceMap={
                    customMaps[activeBookId] ||
                    (activeBookId === 'bolton-2005'
                      ? BOLTON_CH4_REFERENCE_MAP
                      : buildInstrumentsForBook(bookStructure).referenceMap)
                  }
                  attempt={store.mapAttempts[currentSection.chapterId]}
                  onSaveAttempt={(mapAttempt: RetrievalMapAttempt) =>
                    setStore((prev) => ({
                      ...prev,
                      mapAttempts: {
                        ...prev.mapAttempts,
                        [currentSection.chapterId]: mapAttempt,
                      },
                    }))
                  }
                  onJumpToAnchor={jumpToAnchor}
                />
              )}

              {activeStudyTab === 'more' && (
                <DesignedStubsSuite
                  sectionId={currentSection.id}
                  pinnedProject={store.pinnedProject}
                  transferNote={store.transferNotes[currentSection.id] || ''}
                  onUpdatePinnedProject={(proj) =>
                    setStore((prev) => ({ ...prev, pinnedProject: proj }))
                  }
                  onUpdateTransferNote={(note) =>
                    setStore((prev) => ({
                      ...prev,
                      transferNotes: {
                        ...prev.transferNotes,
                        [currentSection.id]: note,
                      },
                    }))
                  }
                  teachBackTranscript={store.teachBackTranscript}
                  onSendTeachBack={(explanation) => {
                    const followUp = explanation.toLowerCase().includes('risk')
                      ? 'Wait—if the principal is risk-neutral, why does the agent’s risk premium ½ηs²σ² reduce the principal’s expected profit?'
                      : 'I see that a = s/c, but why doesn’t paying a higher fixed salary t make the agent work harder too?';
                    setStore((prev) => ({
                      ...prev,
                      teachBackTranscript: [
                        ...prev.teachBackTranscript,
                        { role: 'reader', text: explanation },
                        { role: 'novice', text: followUp },
                      ],
                    }));
                  }}
                  revisitQueue={store.revisitQueue}
                  onAdvanceRevisit={(itemId) =>
                    setStore((prev) => ({
                      ...prev,
                      revisitQueue: prev.revisitQueue.map((item) =>
                        item.id === itemId ? advanceRevisitItem(item, 0) : item
                      ),
                    }))
                  }
                  onJumpToSection={(secId) => selectSection(secId)}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating Jump to Top Button on bottom right */}
      {showJumpToTop && (
        <button
          type="button"
          className="jump-to-top-fab"
          onClick={handleJumpToTop}
          title="Jump to top of page"
          aria-label="Jump to top of page"
        >
          <span className="jump-to-top-arrow">↑</span>
          <span className="jump-to-top-label">Top</span>
        </button>
      )}
    </div>
  );
};

export default App;
