// ============================================================================
// Methods 4 and 6–10: Designed Stubs & Interactive Previews (Marked "next")
// - Method 4: Self-explanation prompts (margin prompt + feedback questions first)
// - Method 6: Data to charts (any table in the book -> interactive chart + 1-click table)
// - Method 7: Book map for navigation (zoomable parts/chapters/recurrence & recall gaps)
// - Method 8: Teach-back (explain to a confused novice that only asks questions)
// - Method 9: Transfer prompts (pin own project e.g. "my business simulator")
// - Method 10: Spaced revisits queue (1, 3, 7, 21 days, interleaved sections)
// ============================================================================

import React, { useState } from 'react';
import {
  RevisitQueueItem,
  SelfExplanationPrompt,
  TableItem,
} from '../types/margin';
import { interleaveRevisitQueue } from '../lib/revisitScheduler';

interface SelfExplanationMarginCardProps {
  prompt: SelfExplanationPrompt;
  savedAnswer?: string;
  onSaveAnswer: (promptId: string, answer: string) => void;
}

export const SelfExplanationMarginCard: React.FC<
  SelfExplanationMarginCardProps
> = ({ prompt, savedAnswer, onSaveAnswer }) => {
  const [answer, setAnswer] = useState(savedAnswer || '');
  const [checkedReasoning, setCheckedReasoning] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState(false);

  return (
    <div className="margin-self-explain-card">
      <div className="margin-card-top">
        <span className="stub-pill">Method 4 · Self-Explanation</span>
        <span className="stub-next-tag">next</span>
      </div>
      <p className="margin-card-question">{prompt.question}</p>
      <textarea
        rows={2}
        placeholder="Explain why this step follows..."
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value);
          onSaveAnswer(prompt.id, e.target.value);
        }}
      />
      <div className="margin-card-actions">
        <button
          type="button"
          className="btn-quiet"
          disabled={answer.trim().length < 5}
          onClick={() => setCheckedReasoning(true)}
        >
          Check My Reasoning
        </button>
        {checkedReasoning && !revealedAnswer && (
          <button
            type="button"
            className="btn-quiet"
            onClick={() => setRevealedAnswer(true)}
          >
            Explicitly Reveal Answer
          </button>
        )}
      </div>
      {checkedReasoning && (
        <div className="margin-feedback-box">
          <strong>Feedback Questions (Socratic check):</strong>
          <ul>
            {prompt.feedbackQuestions.map((fq, i) => (
              <li key={i}>{fq}</li>
            ))}
          </ul>
        </div>
      )}
      {revealedAnswer && (
        <div className="margin-reveal-box">
          <strong>Reference Derivation Note (p. {prompt.anchor.page}):</strong>
          <p>{prompt.revealAnswer}</p>
        </div>
      )}
    </div>
  );
};

interface DataToChartBlockProps {
  table: TableItem;
}

export const DataToChartBlock: React.FC<DataToChartBlockProps> = ({ table }) => {
  const [viewMode, setViewMode] = useState<'table' | 'bar' | 'scatter'>('table');
  const [metricCol, setMetricCol] = useState<number>(table.headers.length - 1);
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const sortedRows = [...table.rows].sort((a, b) => {
    const va = Number(a[metricCol]) || 0;
    const vb = Number(b[metricCol]) || 0;
    return sortAsc ? va - vb : vb - va;
  });

  const maxVal = Math.max(
    0.5,
    ...sortedRows.map((r) => Math.abs(Number(r[metricCol]) || 0))
  );

  return (
    <div className="data-to-chart-card">
      <div className="data-chart-header">
        <div>
          <span className="stub-pill">Method 6 · Data to Charts</span>
          <span className="stub-next-tag">next</span>
          <strong> {table.caption}</strong>
        </div>
        <div className="data-chart-controls">
          <button
            type="button"
            className={`btn-quiet ${viewMode === 'table' ? 'active-toggle' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Original Table (1-Click)
          </button>
          <button
            type="button"
            className={`btn-quiet ${viewMode === 'bar' ? 'active-toggle' : ''}`}
            onClick={() => setViewMode('bar')}
          >
            Bar Chart
          </button>
          <select
            value={metricCol}
            onChange={(e) => setMetricCol(Number(e.target.value))}
            aria-label="Select Chart Column"
          >
            {table.headers.slice(1).map((h, idx) => (
              <option key={h} value={idx + 1}>
                Metric: {h}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => setSortAsc((s) => !s)}
          >
            Sort {sortAsc ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="book-table-scroll">
          <table className="book-table">
            <thead>
              <tr>
                {table.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-chart-bars">
          {sortedRows.map((row, idx) => {
            const label = String(row[0]);
            const val = Number(row[metricCol]) || 0;
            const pct = Math.min(100, Math.round((Math.abs(val) / maxVal) * 100));
            return (
              <div key={idx} className="table-bar-row">
                <span className="table-bar-label">{label}</span>
                <div className="table-bar-track">
                  <div
                    className="table-bar-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <code className="table-bar-val">{val.toFixed(4)}</code>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface DesignedStubsSectionProps {
  sectionId: string;
  pinnedProject: string;
  transferNote: string;
  onUpdatePinnedProject: (proj: string) => void;
  onUpdateTransferNote: (note: string) => void;
  teachBackTranscript: { role: 'reader' | 'novice'; text: string }[];
  onSendTeachBack: (readerExplanation: string) => void;
  revisitQueue: RevisitQueueItem[];
  onAdvanceRevisit: (itemId: string) => void;
  onJumpToSection: (sectionId: string) => void;
}

export const DesignedStubsSuite: React.FC<DesignedStubsSectionProps> = ({
  sectionId,
  pinnedProject,
  transferNote,
  onUpdatePinnedProject,
  onUpdateTransferNote,
  teachBackTranscript,
  onSendTeachBack,
  revisitQueue,
  onAdvanceRevisit,
  onJumpToSection,
}) => {
  const [teachInput, setTeachInput] = useState('');
  const interleavedQueue = interleaveRevisitQueue(revisitQueue);

  return (
    <section
      className="instrument-card stubs-suite-card"
      aria-label="Methods 7 to 10 Designed Stubs"
    >
      <div className="instrument-header">
        <div>
          <span className="instrument-badge">
            Methods 7–10 · Designed Stubs (Visible in UI, Marked “next”)
          </span>
          <h3 className="instrument-title">
            Book Map, Teach-Back Novice, Transfer Prompts & Spaced Revisit Queue
          </h3>
          <p className="instrument-subtitle">
            Each method keeps the reader doing the generative work first.
          </p>
        </div>
      </div>

      <div className="stubs-grid">
        {/* Method 7: Book Map for Navigation */}
        <div className="stub-panel">
          <div className="stub-panel-head">
            <strong>Method 7 · Whole-Book Navigation Map</strong>
            <span className="stub-next-tag">next</span>
          </div>
          <p className="stub-desc">
            Zoomable map of Parts I–IV showing where concepts recur across chapters
            and where your recall gaps are (not a summary to read instead of the book).
          </p>
          <div className="book-map-mini-nodes">
            {[
              { id: '2.1', title: 'Ch. 2 Screening (§2.1)', status: '1 gap · Revisit 3d' },
              { id: '4.1', title: 'Ch. 4 Two-Outcome Moral Hazard (§4.1)', status: 'Recalled ✓' },
              { id: '4.2', title: 'Ch. 4 Linear-CARA Model (§4.2)', status: 'Active Lab ✓' },
              { id: '4.3', title: 'Ch. 4 Suboptimality & Mirrlees (§4.3)', status: 'Unread' },
              { id: '6.2', title: 'Ch. 6 Multitask Moral Hazard (§6.2)', status: 'Recurs from §4.2' },
              { id: '10.1', title: 'Ch. 10 Dynamic Moral Hazard (§10.1)', status: 'Recurs from §4.2' },
            ].map((node) => (
              <button
                key={node.id}
                type="button"
                className={`book-map-node ${node.id === sectionId ? 'node-active' : ''}`}
                onClick={() => onJumpToSection(node.id)}
              >
                <strong>{node.title}</strong>
                <small>{node.status}</small>
              </button>
            ))}
          </div>
        </div>

        {/* Method 8: Teach-Back to a Confused Novice */}
        <div className="stub-panel">
          <div className="stub-panel-head">
            <strong>Method 8 · Teach-Back (“Confused Novice”)</strong>
            <span className="stub-next-tag">next</span>
          </div>
          <p className="stub-desc">
            Explain a concept from §{sectionId}. The novice AI only asks clarifying
            follow-up questions and never explains the material for you.
          </p>
          <div className="teachback-log">
            {teachBackTranscript.map((msg, i) => (
              <div key={i} className={`tb-bubble tb-${msg.role}`}>
                <strong>{msg.role === 'reader' ? 'You:' : 'Confused Novice:'}</strong>{' '}
                {msg.text}
              </div>
            ))}
          </div>
          <form
            className="teachback-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!teachInput.trim()) return;
              onSendTeachBack(teachInput.trim());
              setTeachInput('');
            }}
          >
            <input
              type="text"
              placeholder="Explain why the principal lowers s* when output noise σ² goes up..."
              value={teachInput}
              onChange={(e) => setTeachInput(e.target.value)}
            />
            <button type="submit" className="btn-quiet">
              Teach Novice
            </button>
          </form>
        </div>

        {/* Method 9: Transfer Prompts (Imagining) */}
        <div className="stub-panel">
          <div className="stub-panel-head">
            <strong>Method 9 · Transfer Prompt (Imagining)</strong>
            <span className="stub-next-tag">next</span>
          </div>
          <div className="transfer-pin-row">
            <label>Pinned Project:</label>
            <input
              type="text"
              value={pinnedProject}
              onChange={(e) => onUpdatePinnedProject(e.target.value)}
              placeholder="e.g. my business simulator"
            />
          </div>
          <p className="stub-desc">
            Where does the §{sectionId} risk–incentive trade-off (<code>s* = 1/(1 + ηcσ²)</code>)
            show up in <strong>“{pinnedProject || 'your own work'}”</strong>?
          </p>
          <textarea
            rows={3}
            placeholder={`Map the noisy performance signal q = a + ε and piece rate s* to "${pinnedProject}"...`}
            value={transferNote}
            onChange={(e) => onUpdateTransferNote(e.target.value)}
          />
        </div>

        {/* Method 10: Spaced Revisits (1, 3, 7, 21 days, Interleaved) */}
        <div className="stub-panel">
          <div className="stub-panel-head">
            <strong>Method 10 · Spaced Revisits (1, 3, 7, 21d · Interleaved)</strong>
            <span className="stub-next-tag">next</span>
          </div>
          <p className="stub-desc">
            Built from your recall gaps and unanswered prompts. Interleaves sections
            across different chapters—no isolated flashcards, no streak mechanics.
          </p>
          <ul className="revisit-queue-list">
            {interleavedQueue.map((item) => (
              <li key={item.id} className="revisit-queue-item">
                <div>
                  <strong>
                    Ch.{item.chapterId} · §{item.sectionId}
                  </strong>{' '}
                  <span>({item.intervalDays}d interval · {item.recommendedMode.replace('_', ' ')})</span>
                  <small className="revisit-meta">
                    {item.gapCount} recall gaps · {item.unansweredPromptsCount} open prompts · Due{' '}
                    {item.dueAt.slice(0, 10)}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => onAdvanceRevisit(item.id)}
                >
                  Simulate Revisit (+{item.intervalDays}d)
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
