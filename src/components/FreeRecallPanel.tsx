// ============================================================================
// Method 2: Free Recall at Section Ends (Retrieval Practice)
// Evidence base: Dunlosky et al. (2013); Karpicke & Blunt (2011)
// Rule:
// - At a section break, offer "Close the book and write what you remember."
// - The page blurs until the reader writes or skips.
// - Afterwards, show a side-by-side: their recall on one side; on the other,
//   the section's key ideas, each with a jump link to its location on the page.
// - Their own words get a ✓ or a gap marker. The AI marks coverage; it does
//   NOT grade the prose.
// - Summaries exist ONLY behind the reader's own attempt ("Write your summary,
//   then compare"). Never auto-summarise on open.
// ============================================================================

import React, { useState } from 'react';
import {
  FreeRecallAttempt,
  SectionKeyIdea,
} from '../types/margin';
import { evaluateFreeRecallCoverage } from '../lib/recallEvaluator';

interface FreeRecallPanelProps {
  bookId: string;
  sectionId: string;
  sectionTitle: string;
  keyIdeas: SectionKeyIdea[];
  attempts: FreeRecallAttempt[];
  isPageBlurred: boolean;
  onTogglePageBlur: (blur: boolean) => void;
  onSaveAttempt: (attempt: FreeRecallAttempt, gapCount: number) => void;
  onUpdateKeyIdeas: (ideas: SectionKeyIdea[]) => void;
  onJumpToAnchor: (page: number, paragraphId?: string) => void;
}

export const FreeRecallPanel: React.FC<FreeRecallPanelProps> = ({
  bookId,
  sectionId,
  sectionTitle,
  keyIdeas,
  attempts,
  isPageBlurred,
  onTogglePageBlur,
  onSaveAttempt,
  onUpdateKeyIdeas,
  onJumpToAnchor,
}) => {
  const latestAttempt = attempts[attempts.length - 1] || null;
  const [recallDraft, setRecallDraft] = useState<string>(
    latestAttempt?.readerText || ''
  );
  const [skipped, setSkipped] = useState<boolean>(false);
  const [editingIdeas, setEditingIdeas] = useState<boolean>(false);

  // Summary comparison gate (Summaries exist ONLY behind the reader's own attempt)
  const [summaryDraft, setSummaryDraft] = useState<string>(
    latestAttempt?.readerSummaryAttempt || ''
  );
  const [summaryCompared, setSummaryCompared] = useState<boolean>(
    Boolean(latestAttempt?.summaryComparisonUnlocked)
  );

  const startRecallWithBlur = () => {
    setSkipped(false);
    onTogglePageBlur(true);
  };

  const handleSubmitRecall = () => {
    if (!recallDraft.trim()) return;
    const coverage = evaluateFreeRecallCoverage(recallDraft, keyIdeas);
    const gapCount = coverage.filter((c) => c.status !== 'covered').length;

    const attempt: FreeRecallAttempt = {
      id: `recall-${sectionId}-${Date.now()}`,
      bookId,
      sectionId,
      readerText: recallDraft.trim(),
      createdAt: new Date().toISOString(),
      coverage,
      summaryComparisonUnlocked: summaryCompared,
      readerSummaryAttempt: summaryDraft || undefined,
    };

    onTogglePageBlur(false);
    onSaveAttempt(attempt, gapCount);
  };

  const handleSkipRecall = () => {
    setSkipped(true);
    onTogglePageBlur(false);
  };

  const loadSampleRecallForDemo = () => {
    setRecallDraft(
      'In Bolton §4.2, performance is q = a + noise (normal distribution with variance sigma^2) and the principal offers a linear contract w = t + s*q. Because the agent has CARA exponential utility and quadratic effort cost c*a^2/2, maximizing expected utility is equivalent to maximizing the certainty equivalent t + s*a - c*a^2/2 - 0.5*eta*s^2*sigma^2. From the agent IC first-order condition, effort is a = s/c (independent of fixed wage t). Substituting into the principal objective gives the optimal second-best piece rate s* = 1 / (1 + eta*c*sigma^2).'
    );
  };

  return (
    <section
      className="instrument-card recall-instrument"
      aria-label="Free Recall at Section End"
    >
      <div className="instrument-header">
        <div>
          <span className="instrument-badge">
            Method 2 · Retrieval Practice (Free Recall at Section End)
          </span>
          <h3 className="instrument-title">
            Close the book and write what you remember from §{sectionId} ({sectionTitle})
          </h3>
          <p className="instrument-subtitle">
            Retrieval practice beats re-reading and open-book concept mapping (Dunlosky et al., 2013;
            Karpicke & Blunt, 2011). The AI marks concept coverage; it does not grade your prose.
          </p>
        </div>
        <div className="instrument-meta-actions">
          {!isPageBlurred ? (
            <button
              type="button"
              className="btn-primary"
              onClick={startRecallWithBlur}
            >
              Close the Book (Blur Page & Recall)
            </button>
          ) : (
            <button
              type="button"
              className="btn-quiet"
              onClick={handleSkipRecall}
            >
              Skip & Unblur Page
            </button>
          )}
          <button
            type="button"
            className="btn-quiet"
            onClick={() => setEditingIdeas((v) => !v)}
          >
            {editingIdeas ? 'Done Editing Anchors' : 'Edit Key-Idea Anchors'}
          </button>
        </div>
      </div>

      {/* Editable Key-Idea Anchors (only after attempt or when explicitly editing) */}
      {editingIdeas && (
        <div className="spec-editor-panel">
          <strong>Anchored Key Ideas for §{sectionId} (Editable / Deletable by Reader)</strong>
          {keyIdeas.map((ki, idx) => (
            <div key={ki.id} className="spec-formula-row">
              <label>p. {ki.anchor.page}:</label>
              <input
                type="text"
                value={ki.idea}
                onChange={(e) => {
                  const next = [...keyIdeas];
                  next[idx] = { ...ki, idea: e.target.value, editedByReader: true };
                  onUpdateKeyIdeas(next);
                }}
              />
              <button
                type="button"
                className="btn-quiet"
                onClick={() =>
                  onUpdateKeyIdeas(keyIdeas.filter((item) => item.id !== ki.id))
                }
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reader Free Recall Input */}
      <div className="recall-input-area">
        <div className="recall-prompt-bar">
          <span>
            {isPageBlurred
              ? '🔒 Book page is blurred while you retrieve from memory.'
              : 'Write everything you recall about the model assumptions, certainty equivalent, IC condition, and optimal contract:'}
          </span>
          <button
            type="button"
            className="btn-quiet"
            onClick={loadSampleRecallForDemo}
          >
            Fill Demo Recall Attempt
          </button>
        </div>
        <textarea
          rows={5}
          className="recall-textarea"
          placeholder="Close the book and reconstruct §4.2 in your own words: what is the agent's utility, why does CARA + Normal yield a closed-form certainty equivalent, how does the agent choose effort a, and what is the second-best slope s*?"
          value={recallDraft}
          onChange={(e) => setRecallDraft(e.target.value)}
          onFocus={() => {
            if (!latestAttempt && !skipped && !isPageBlurred) {
              onTogglePageBlur(true);
            }
          }}
        />
        <div className="recall-action-row">
          <button
            type="button"
            className="btn-primary"
            disabled={!recallDraft.trim()}
            onClick={handleSubmitRecall}
          >
            Compare My Recall Against Section Key Ideas
          </button>
          {isPageBlurred && (
            <button
              type="button"
              className="btn-quiet"
              onClick={handleSkipRecall}
            >
              Skip Recall & Unblur Page
            </button>
          )}
        </div>
      </div>

      {/* Side-by-Side Comparison (Shown ONLY after the reader's attempt) */}
      {latestAttempt && (
        <div className="recall-side-by-side" role="region" aria-label="Recall Comparison">
          <div className="recall-col reader-attempt-col">
            <h4>Your Recall Attempt (Annotated for Coverage)</h4>
            <p className="recall-reader-prose">{latestAttempt.readerText}</p>
            <div className="recall-coverage-chips">
              {latestAttempt.coverage.map((cov, idx) => (
                <span
                  key={cov.ideaId}
                  className={`cov-chip cov-${cov.status}`}
                >
                  {cov.status === 'covered'
                    ? `✓ Idea ${idx + 1} covered`
                    : cov.status === 'partial'
                      ? `◐ Idea ${idx + 1} partial`
                      : `○ Idea ${idx + 1} gap`}
                </span>
              ))}
            </div>
          </div>

          <div className="recall-col key-ideas-col">
            <h4>Section §{sectionId} Key Ideas (with Page Jump Links)</h4>
            <ul className="key-ideas-list">
              {keyIdeas.map((ki) => {
                const cov = latestAttempt.coverage.find((c) => c.ideaId === ki.id);
                const status = cov?.status || 'gap';
                return (
                  <li key={ki.id} className={`key-idea-item status-${status}`}>
                    <div className="key-idea-marker">
                      {status === 'covered' ? '✓' : status === 'partial' ? '◐' : 'GAP'}
                    </div>
                    <div className="key-idea-body">
                      <p>{ki.idea}</p>
                      {cov?.matchedReaderPhrase && (
                        <small className="matched-phrase">
                          Your words: “{cov.matchedReaderPhrase}”
                        </small>
                      )}
                      <div className="key-idea-footer">
                        <button
                          type="button"
                          className="anchor-pill"
                          onClick={() =>
                            onJumpToAnchor(ki.anchor.page, ki.anchor.paragraphId)
                          }
                        >
                          Jump to p. {ki.anchor.page} ({ki.anchor.excerptShort || `§${sectionId}`})
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Summaries Rule: Summaries exist ONLY behind the reader's own attempt */}
      <details className="summary-gate-details">
        <summary>
          Write Your 2-Sentence Summary, Then Compare (Never Auto-Summarised)
        </summary>
        <div className="summary-gate-body">
          <textarea
            rows={2}
            placeholder="Write your own 1–2 sentence synthesis of §4.2 before unlocking the reference synthesis..."
            value={summaryDraft}
            onChange={(e) => setSummaryDraft(e.target.value)}
          />
          <button
            type="button"
            className="btn-quiet"
            disabled={summaryDraft.trim().length < 15}
            onClick={() => setSummaryCompared(true)}
          >
            Unlock Reference Comparison
          </button>
          {summaryCompared && summaryDraft.trim().length >= 15 && (
            <div className="summary-comparison-grid">
              <div>
                <strong>Your Summary:</strong>
                <p>{summaryDraft}</p>
              </div>
              <div>
                <strong>Reference Synthesis (Anchored to pp. 137–139):</strong>
                <p>
                  Under CARA preferences and normal noise, linear contracts{' '}
                  <code>w = t + sq</code> yield a tractable certainty equivalent
                  where effort is <code>a = s/c</code> and the optimal second-best
                  slope <code>s* = 1/(1 + ηcσ²)</code> trades off effort incentives
                  against variance risk premia.
                </p>
              </div>
            </div>
          )}
        </div>
      </details>
    </section>
  );
};
