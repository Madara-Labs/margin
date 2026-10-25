// ============================================================================
// Core Domain Types for "Margin" — Reader-First Study Tool
// Principle: The book stays in the middle. The reader's attempt comes first;
// AI output comes second, as a comparison. Every AI-generated element is
// anchored to a source location and is editable/deletable by the reader.
// ============================================================================

export interface SourceAnchor {
  bookId: string;
  sectionId: string;
  page: number;           // 1-based book or PDF page
  pdfPage?: number;       // 1-based PDF page index
  paragraphId?: string;
  excerptShort?: string;  // Short reference label (never full copyrighted text in exports)
}

export interface EquationItem {
  id: string;
  sectionId: string;
  page: number;
  latex: string;
  label?: string;         // e.g., "(4.2)" or "IC" or "Optimal Slope s*"
  description: string;
}

export interface TableItem {
  id: string;
  sectionId: string;
  page: number;
  caption: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface WorkedExampleItem {
  id: string;
  sectionId: string;
  page: number;
  title: string;
  parameters: Record<string, number>;
  expectedOutputs: Record<string, number>;
  notes?: string;
}

export interface PdfCropRegion {
  pdfPage: number;
  yTop: number;
  yBottom: number;
  caption?: string;
  label?: string;
}

export interface ParagraphBlock {
  id: string;
  sectionId: string;
  page: number;
  index: number;
  text: string;
  kind: 'prose' | 'equation' | 'derivation' | 'example' | 'table' | 'figure';
  latex?: string;
  equationLabel?: string;
  tableData?: TableItem;
  pdfCrop?: PdfCropRegion;
}

export interface BookSection {
  id: string;             // e.g. "4.2"
  chapterId: string;      // e.g. "4"
  number: string;         // e.g. "4.2"
  title: string;          // e.g. "Linear Contracts, Normally Distributed Performance, and Exponential Utility"
  startPage: number;      // Book page
  endPage: number;
  pdfStartPage?: number;
  pdfEndPage?: number;
  paragraphs: ParagraphBlock[];
  equations: EquationItem[];
  tables: TableItem[];
  workedExamples: WorkedExampleItem[];
}

export interface TocEntry {
  id: string;
  number: string;
  title: string;
  level: 1 | 2 | 3;       // 1 = Part/Chapter, 2 = Section, 3 = Subsection
  page: number;
  pdfPage?: number;
}

export interface BookStructure {
  bookId: string;
  title: string;
  authors: string;
  license?: string;
  totalPages: number;
  pdfAvailable?: boolean;
  pdfFilename?: string;
  toc: TocEntry[];
  sections: BookSection[];
}

// ============================================================================
// Reader Highlights & Margin Notes
// ============================================================================

export interface HighlightItem {
  id: string;
  bookId: string;
  sectionId: string;
  paragraphId: string;
  page: number;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  color: 'amber' | 'sage' | 'sky' | 'rose';
  note?: string;
  createdAt: string;
}

export interface MarginNote {
  id: string;
  bookId: string;
  sectionId: string;
  paragraphId: string;
  page: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Method 1: Pre-questions (Pretesting Effect)
// ============================================================================

export interface PreQuestion {
  id: string;
  sectionId: string;
  question: string;
  targetParagraphId: string; // Where the guess resurfaces beside the answering passage
  anchor: SourceAnchor;
  readerGuess?: string;      // Reader's 1-line guess before reading
  guessedAt?: string;
  resurfacedReflection?: string;
  editedByReader?: boolean;
  deletedByReader?: boolean;
}

// ============================================================================
// Method 2: Free Recall at Section Ends (Retrieval Practice)
// ============================================================================

export interface SectionKeyIdea {
  id: string;
  sectionId: string;
  idea: string;
  keywords: string[];        // Used for coverage marking alongside LLM/local check
  anchor: SourceAnchor;
  editedByReader?: boolean;
}

export interface KeyIdeaCoverage {
  ideaId: string;
  status: 'covered' | 'partial' | 'gap';
  matchedReaderPhrase?: string;
  note?: string;
}

export interface FreeRecallAttempt {
  id: string;
  bookId: string;
  sectionId: string;
  readerText: string;
  createdAt: string;
  coverage: KeyIdeaCoverage[];
  summaryComparisonUnlocked?: boolean;
  readerSummaryAttempt?: string;
}

// ============================================================================
// Method 3: Retrieval Maps (Concept Maps from Memory + Diff Overlay)
// ============================================================================

export interface ConceptNode {
  id: string;
  label: string;
  x: number;
  y: number;
  anchor?: SourceAnchor;     // Every node in reference map links to its source page
  category?: 'primitive' | 'constraint' | 'choice' | 'outcome' | 'theorem';
}

export interface ConceptEdge {
  id: string;
  source: string;            // Node ID or label
  target: string;            // Node ID or label
  label: string;             // Directed relation label
  anchor?: SourceAnchor;
}

export interface ConceptMapSpec {
  chapterId: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

export interface MapDiffResult {
  matchedNodeIds: string[];          // Reader nodes matching reference nodes
  missingReferenceNodes: ConceptNode[]; // Reference nodes the reader missed
  extraReaderNodes: ConceptNode[];   // Valid/custom reader nodes not in reference
  matchedEdgeIds: string[];
  missingReferenceEdges: ConceptEdge[];
}

export interface RetrievalMapAttempt {
  id: string;
  bookId: string;
  chapterId: string;
  readerNodes: ConceptNode[];
  readerEdges: ConceptEdge[];
  revealedReference: boolean;
  diff?: MapDiffResult;
  updatedAt: string;
}

// ============================================================================
// Method 5: Explorable Models (Enacting, Dual Coding, Predict First, Verified)
// ============================================================================

export interface LabParameterSpec {
  name: string;              // e.g. "c"
  symbol: string;            // e.g. "c"
  label: string;             // e.g. "Effort cost coefficient (c)"
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
}

export interface LabFormulaSpec {
  name: string;              // e.g. "s_star"
  symbol: string;            // e.g. "s*"
  label: string;             // e.g. "Second-best optimal slope (s*)"
  expression: string;        // Evaluated via mathjs (never eval)
  latex?: string;
  description?: string;
}

export interface LabWorkedExampleCheck {
  id: string;
  title: string;
  anchor: SourceAnchor;
  inputs: Record<string, number>;
  expected: Record<string, number>;
  tolerance?: number;
}

export interface LabChartSeriesSpec {
  key: string;               // Formula name or expression over xVariable
  label: string;
  expression: string;        // Expression in terms of params + xVariable
  color: string;
  dashed?: boolean;
}

export interface LabChartSpec {
  xVariable: string;         // e.g. "s" or "eta"
  xLabel: string;
  xMin: number;
  xMax: number;
  yLabel: string;
  series: LabChartSeriesSpec[];
}

export interface ExplorableLabSpec {
  id: string;
  sectionId: string;
  title: string;
  subtitle: string;
  anchor: SourceAnchor;
  parameters: LabParameterSpec[];
  formulas: LabFormulaSpec[];
  chart: LabChartSpec;
  workedExamples: LabWorkedExampleCheck[];
  assumptions: { name: string; expression: string; description: string }[];
  scopeNote: string;
  editedByReader?: boolean;
}

export interface ExampleCheckDetail {
  exampleId: string;
  title: string;
  outputName: string;
  expected: number;
  actual: number;
  absError: number;
  passed: boolean;
  reason?: string;
}

export interface LabCertificate {
  labId: string;
  verifiedAt: string;
  passed: boolean;
  assumptionsPassed: boolean;
  checks: ExampleCheckDetail[];
  kktOrGridResidual?: number;
  failureReasons: string[];
  trace: string[];
}

export interface SliderPrediction {
  id: string;
  labId: string;
  parameterChanged: string;
  fromValue: number;
  toValue: number;
  targetOutput: string;      // e.g. "pi_sb" (Second-best profit) or "s_star"
  prediction: 'up' | 'down' | 'same';
  actualDirection: 'up' | 'down' | 'same';
  beforeOutputValue: number;
  afterOutputValue: number;
  correct: boolean;
  createdAt: string;
}

// ============================================================================
// Method 10: Spaced Revisits (1, 3, 7, 21 days, Interleaved Sections)
// ============================================================================

export type RevisitIntervalDays = 1 | 3 | 7 | 21;

export interface RevisitQueueItem {
  id: string;
  bookId: string;
  sectionId: string;
  chapterId: string;
  sectionTitle: string;
  gapCount: number;
  unansweredPromptsCount: number;
  recommendedMode: 'free_recall' | 'retrieval_map';
  intervalDays: RevisitIntervalDays;
  stageIndex: number;        // 0 -> 1d, 1 -> 3d, 2 -> 7d, 3 -> 21d
  lastAttemptAt: string;     // ISO timestamp
  dueAt: string;             // ISO timestamp
  completedCount: number;
}

// ============================================================================
// Methods 4, 6-9: Designed Stubs + Interactive Previews
// ============================================================================

export interface SelfExplanationPrompt {
  id: string;
  sectionId: string;
  paragraphId: string;
  anchor: SourceAnchor;
  question: string;
  feedbackQuestions: string[];
  revealAnswer: string;
  readerAnswer?: string;
}

// ============================================================================
// LLM Prompt Transparency Log ("What the AI was asked" panel)
// ============================================================================

export interface PromptLogEntry {
  id: string;
  timestamp: string;
  method: 'pre_questions' | 'free_recall_check' | 'reference_map' | 'explorable_lab' | 'self_explanation';
  sectionId: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  sectionExcerptCharCount: number;
  status: 'completed' | 'cached_local' | 'error';
  responseSummary?: string;
}
