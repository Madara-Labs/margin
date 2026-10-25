// ============================================================================
// Local-First Persistence & Privacy-Safe Export (Markdown + JSON)
// Hard Rule: Exports contain ONLY what the reader created plus short anchored
// references (page numbers & section IDs), NEVER the book's copyrighted text.
// ============================================================================

import {
  ExplorableLabSpec,
  FreeRecallAttempt,
  HighlightItem,
  MarginNote,
  PreQuestion,
  PromptLogEntry,
  RetrievalMapAttempt,
  RevisitQueueItem,
  SectionKeyIdea,
  SliderPrediction,
} from '../types/margin';

export interface PerBookStoreState {
  bookId: string;
  lastSectionId: string;
  lastPage: number;
  lastScrollTop: number;
  highlights: HighlightItem[];
  marginNotes: MarginNote[];
  preQuestions: PreQuestion[];
  keyIdeas: SectionKeyIdea[];
  recallAttempts: FreeRecallAttempt[];
  mapAttempts: Record<string, RetrievalMapAttempt>;
  labSpecs: Record<string, ExplorableLabSpec>;
  predictions: SliderPrediction[];
  revisitQueue: RevisitQueueItem[];
  selfExplanations: Record<string, string>;
  pinnedProject: string;
  transferNotes: Record<string, string>;
  teachBackTranscript: { role: 'reader' | 'novice'; text: string }[];
  promptLogs: PromptLogEntry[];
}

const STORAGE_PREFIX = 'margin_book_store_v2_';

export function loadLocalBookState(
  bookId: string,
  fallback: PerBookStoreState
): PerBookStoreState {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${bookId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const existingPqIds = new Set(
      (parsed.preQuestions || []).map((p: PreQuestion) => p.id)
    );
    const mergedPreQuestions = [
      ...(parsed.preQuestions || []),
      ...(fallback.preQuestions || []).filter((p) => !existingPqIds.has(p.id)),
    ];
    const existingKiIds = new Set(
      (parsed.keyIdeas || []).map((k: SectionKeyIdea) => k.id)
    );
    const mergedKeyIdeas = [
      ...(parsed.keyIdeas || []),
      ...(fallback.keyIdeas || []).filter((k) => !existingKiIds.has(k.id)),
    ];
    return {
      ...fallback,
      ...parsed,
      preQuestions: mergedPreQuestions,
      keyIdeas: mergedKeyIdeas,
    };
  } catch {
    return fallback;
  }
}

export function saveLocalBookState(state: PerBookStoreState): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${state.bookId}`,
      JSON.stringify(state)
    );
  } catch {
    // ignore storage quota errors
  }

  // Also sync asynchronously to local SQLite sidecar if running
  fetch('/api/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookId: state.bookId, state }),
  }).catch(() => {
    // Sidecar is optional when running pure client
  });
}

/**
 * Generates a privacy- and copyright-compliant JSON + Markdown export of
 * everything the reader created (guesses, free-recall attempts, concept maps,
 * predictions, margin notes, highlights with short page anchors only).
 */
export function buildReaderExport(
  bookTitle: string,
  state: PerBookStoreState
): { markdown: string; json: string } {
  const exportedAt = new Date().toISOString();

  const safeJsonPayload = {
    schema: 'margin-reader-export/v1',
    exportedAt,
    copyrightNotice:
      'Contains only reader-authored study artefacts and short page/section anchors. No copyrighted book text is included.',
    bookId: state.bookId,
    bookTitle,
    readingPosition: {
      sectionId: state.lastSectionId,
      page: state.lastPage,
    },
    preQuestionGuesses: state.preQuestions
      .filter((pq) => pq.readerGuess && !pq.deletedByReader)
      .map((pq) => ({
        questionId: pq.id,
        sectionId: pq.sectionId,
        pageAnchor: pq.anchor.page,
        question: pq.question,
        readerGuess: pq.readerGuess,
        guessedAt: pq.guessedAt,
      })),
    freeRecallAttempts: state.recallAttempts.map((att) => ({
      id: att.id,
      sectionId: att.sectionId,
      createdAt: att.createdAt,
      readerRecallText: att.readerText,
      readerSummaryAttempt: att.readerSummaryAttempt,
      coverageSummary: att.coverage.map((c) => ({
        ideaId: c.ideaId,
        status: c.status,
      })),
    })),
    retrievalMaps: Object.values(state.mapAttempts).map((m) => ({
      chapterId: m.chapterId,
      updatedAt: m.updatedAt,
      readerNodes: m.readerNodes.map((n) => ({ label: n.label })),
      readerEdges: m.readerEdges.map((e) => ({
        source: e.source,
        target: e.target,
        label: e.label,
      })),
    })),
    labPredictions: state.predictions.map((p) => ({
      labId: p.labId,
      parameterChanged: p.parameterChanged,
      fromValue: p.fromValue,
      toValue: p.toValue,
      targetOutput: p.targetOutput,
      prediction: p.prediction,
      actualDirection: p.actualDirection,
      correct: p.correct,
      createdAt: p.createdAt,
    })),
    marginNotes: state.marginNotes.map((n) => ({
      sectionId: n.sectionId,
      pageAnchor: n.page,
      paragraphAnchor: n.paragraphId,
      readerNote: n.content,
      createdAt: n.createdAt,
    })),
    highlightAnchors: state.highlights.map((h) => ({
      sectionId: h.sectionId,
      pageAnchor: h.page,
      paragraphAnchor: h.paragraphId,
      charRange: [h.startOffset, h.endOffset],
      shortAnchorPreview:
        h.selectedText.length > 48
          ? `${h.selectedText.slice(0, 45)}...`
          : h.selectedText,
      readerNote: h.note,
    })),
    revisitSchedule: state.revisitQueue,
    pinnedProject: state.pinnedProject,
    transferNotes: state.transferNotes,
  };

  const mdLines: string[] = [
    `# Margin Study Export — ${bookTitle}`,
    `> Exported: ${exportedAt} | Book ID: \`${state.bookId}\``,
    `> Privacy & Copyright Rule: Contains only reader-authored work and page anchors (no book text).`,
    '',
    `## 1. Pre-Question Guesses (Pretesting Effect)`,
  ];

  const answeredPqs = state.preQuestions.filter(
    (p) => p.readerGuess && !p.deletedByReader
  );
  if (answeredPqs.length === 0) {
    mdLines.push('_No pre-question guesses recorded yet._');
  } else {
    for (const pq of answeredPqs) {
      mdLines.push(
        `- **[§${pq.sectionId}, p. ${pq.anchor.page}]** _${pq.question}_`,
        `  - **My Pre-Reading Guess:** ${pq.readerGuess}`
      );
    }
  }

  mdLines.push('', '## 2. Free Recall Attempts (Retrieval Practice)');
  if (state.recallAttempts.length === 0) {
    mdLines.push('_No free recall attempts recorded yet._');
  } else {
    for (const att of state.recallAttempts) {
      const covered = att.coverage.filter((c) => c.status === 'covered').length;
      const gaps = att.coverage.filter((c) => c.status === 'gap').length;
      mdLines.push(
        `### §${att.sectionId} (${att.createdAt}) — Coverage: ${covered} ✓, ${gaps} gaps`,
        '',
        att.readerText,
        ''
      );
      if (att.readerSummaryAttempt) {
        mdLines.push(`**My Summary:** ${att.readerSummaryAttempt}`, '');
      }
    }
  }

  mdLines.push('', '## 3. Retrieval Maps (Concept Maps from Memory)');
  const maps = Object.values(state.mapAttempts);
  if (maps.length === 0) {
    mdLines.push('_No retrieval maps drawn yet._');
  } else {
    for (const m of maps) {
      mdLines.push(
        `### Chapter ${m.chapterId} (${m.readerNodes.length} nodes, ${m.readerEdges.length} links)`
      );
      for (const e of m.readerEdges) {
        const s = m.readerNodes.find((n) => n.id === e.source)?.label || e.source;
        const t = m.readerNodes.find((n) => n.id === e.target)?.label || e.target;
        mdLines.push(`- \`${s}\` —(${e.label})→ \`${t}\``);
      }
    }
  }

  mdLines.push('', '## 4. Explorable Model Predictions (Enacting)');
  if (state.predictions.length === 0) {
    mdLines.push('_No slider predictions committed yet._');
  } else {
    for (const p of state.predictions) {
      mdLines.push(
        `- **${p.parameterChanged}** (${p.fromValue} → ${p.toValue}): predicted \`${p.targetOutput}\` goes **${p.prediction}**, actual **${p.actualDirection}** (${p.correct ? '✓ Correct' : '✗ Surprise'})`
      );
    }
  }

  mdLines.push('', '## 5. Margin Notes & Highlight Anchors');
  for (const n of state.marginNotes) {
    mdLines.push(`- **[§${n.sectionId}, p. ${n.page}]** ${n.content}`);
  }
  for (const h of state.highlights) {
    const snippet =
      h.selectedText.length > 48
        ? `${h.selectedText.slice(0, 45)}...`
        : h.selectedText;
    mdLines.push(
      `- **[Highlight §${h.sectionId}, p. ${h.page}]** "${snippet}" ${h.note ? `— _Note: ${h.note}_` : ''}`
    );
  }

  return {
    markdown: mdLines.join('\n'),
    json: JSON.stringify(safeJsonPayload, null, 2),
  };
}
