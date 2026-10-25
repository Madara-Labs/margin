// ============================================================================
// Margin Feature Showcase & Guided Onboarding Walkthrough
// Introduces new and returning readers to Margin's core philosophy:
// "The book stays in the middle. The reader does the generative thinking first;
// software & AI provide comparison and cognitive leverage second."
// ============================================================================

import React, { useState } from 'react';

interface ShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpToSection?: (sectionId: string) => void;
  onOpenShortcuts?: () => void;
}

interface ShowcaseStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  icon: string;
  bullets: { title: string; desc: string; shortcut?: string }[];
  visualPreview: {
    type: 'philosophy' | 'reading' | 'prequestions' | 'recall_map' | 'lab' | 'shortcuts_library';
    tag: string;
  };
  actionButton?: {
    label: string;
    onClick: () => void;
  };
}

export const ShowcaseModal: React.FC<ShowcaseModalProps> = ({
  isOpen,
  onClose,
  onJumpToSection,
  onOpenShortcuts,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);

  if (!isOpen) return null;

  const steps: ShowcaseStep[] = [
    {
      id: 'philosophy',
      badge: 'Core Philosophy',
      icon: '📖',
      title: 'The Book Stays in the Middle',
      subtitle:
        'Margin is a study tool designed for rigorous textbooks. You do the thinking; the software provides cognitive leverage.',
      bullets: [
        {
          title: 'You read the book, not a summary',
          desc: 'Chatbots and summaries bypass the struggle required to learn. Margin keeps the full text centered in front of you.',
        },
        {
          title: 'Active retrieval before comparison',
          desc: 'AI feedback and reference solutions only unlock after your own attempt, providing comparison rather than spoon-feeding.',
        },
        {
          title: 'Anchored & Copyright-Safe',
          desc: 'Every note, question, and formula anchors to an exact page number. Exports contain only your own work.',
        },
      ],
      visualPreview: {
        type: 'philosophy',
        tag: 'Reader-First Learning Architecture',
      },
    },
    {
      id: 'reader_view',
      badge: 'Reading Experience',
      icon: '✍️',
      title: 'Distraction-Free Reading & Margin Notes',
      subtitle:
        'A clean serif reading sheet with high-DPI PDF graphics and quiet margins.',
      bullets: [
        {
          title: 'High-DPI PDF Figures & Scanned Math',
          desc: 'Charts (scatter plots, distributions, curves) and scanned display equations are cropped directly from the PDF canvas with zero OCR noise.',
        },
        {
          title: 'Select to Auto-Copy & Instant Highlighting',
          desc: 'Selecting any sentence immediately copies it to your clipboard. Press H to save a highlight to the margin.',
          shortcut: 'H',
        },
        {
          title: 'Quiet Margin Notes',
          desc: 'Hover over any paragraph to anchor a private margin note right beside the passage.',
          shortcut: 'M',
        },
      ],
      visualPreview: {
        type: 'reading',
        tag: 'Clean Typography + PDF Visual Crops + Margin Notes',
      },
      actionButton: {
        label: 'Explore Reading View →',
        onClick: () => {
          onJumpToSection?.('1.1');
          onClose();
        },
      },
    },
    {
      id: 'prequestions',
      badge: 'Method 1 · Pretesting Effect',
      icon: '❓',
      title: 'Pre-Questions: Guess Before You Read',
      subtitle:
        'Research shows that committing an intuitive guess before reading dramatically improves comprehension and retention.',
      bullets: [
        {
          title: 'Commit a 1-line guess',
          desc: 'Before reading a section, commit a quick intuitive prediction about the core argument or trade-off.',
        },
        {
          title: 'Resurfacing in the margin',
          desc: 'As you read down the page, your guess automatically resurfaces in the right margin beside the passage that answers it.',
        },
        {
          title: 'Productive failure',
          desc: 'Even when your initial guess is wrong, the cognitive contrast cements the theoretical insight.',
        },
      ],
      visualPreview: {
        type: 'prequestions',
        tag: 'Intuitive Guessing Resurfaced Beside Source Text',
      },
    },
    {
      id: 'recall_map',
      badge: 'Methods 2 & 3 · Active Retrieval',
      icon: '🧠',
      title: 'Close the Book: Free Recall & Retrieval Map',
      subtitle:
        'Deep understanding requires retrieving knowledge from memory, not just re-reading.',
      bullets: [
        {
          title: 'Close the Book (Page Blur)',
          desc: 'Press F to blur the text and test what you recall without peeking.',
          shortcut: 'F',
        },
        {
          title: 'Free Recall Check (Method 2)',
          desc: 'Write down what you remember. AI compares your attempt against key concepts and highlights your coverage and gaps.',
        },
        {
          title: 'Interactive Concept Map (Method 3)',
          desc: 'Drag nodes, double-click to add concepts, and connect directed arrows from memory. Reveal the reference diff to spot missing links.',
        },
      ],
      visualPreview: {
        type: 'recall_map',
        tag: 'Free Recall + Interactive Concept Map Canvas',
      },
    },
    {
      id: 'explorable_lab',
      badge: 'Method 5 · Dual Coding',
      icon: '🧪',
      title: 'Interactive Models with Mandatory Verification',
      subtitle:
        'Bring abstract equations to life with verified mathematical simulations.',
      bullets: [
        {
          title: 'Predict-First Slider Gates',
          desc: 'Before adjusting parameters, predict whether the retention rate R(t) will increase, decrease, or remain constant.',
        },
        {
          title: '100% Textbook Verified',
          desc: 'All formula evaluations are mathematically verified against published numerical worked examples in the text.',
        },
        {
          title: 'Multi-Series Interactive Charts',
          desc: 'See how memory consolidation curves evolve in real time as spacing intervals or repetition counts change.',
        },
      ],
      visualPreview: {
        type: 'lab',
        tag: 'Verified Spaced Retrieval & Memory Consolidation Model',
      },
      actionButton: {
        label: 'Explore Interactive Model →',
        onClick: () => {
          onJumpToSection?.('4.2');
          onClose();
        },
      },
    },
    {
      id: 'shortcuts_library',
      badge: 'Power Tools & Any PDF',
      icon: '⚡',
      title: 'Keyboard Mastery, Custom PDFs & Export',
      subtitle:
        'Study any textbook on your machine and navigate at the speed of thought.',
      bullets: [
        {
          title: 'Full Keyboard Navigation',
          desc: 'Press ? anytime to open the shortcuts cheat sheet. Navigate with [, ], J, K, and switch views with 1, 2, 3.',
          shortcut: '?',
        },
        {
          title: 'Open Any Local PDF',
          desc: 'Click "Open Local PDF" in Settings to extract sections, Table of Contents, and auto-build study tools for any book.',
          shortcut: 'O',
        },
        {
          title: 'Privacy-Compliant Export',
          desc: 'Export your highlights, guesses, recall attempts, and margin notes to Markdown & JSON with short page anchors.',
          shortcut: 'E',
        },
      ],
      visualPreview: {
        type: 'shortcuts_library',
        tag: 'Keyboard Shortcuts + Any Local PDF Ingestion',
      },
      actionButton: {
        label: 'View Keyboard Shortcuts (?) →',
        onClick: () => {
          onClose();
          onOpenShortcuts?.();
        },
      },
    },
  ];

  const currentStep = steps[currentStepIdx];
  const isFirstStep = currentStepIdx === 0;
  const isLastStep = currentStepIdx === steps.length - 1;

  const nextStep = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStepIdx((idx) => Math.min(steps.length - 1, idx + 1));
    }
  };

  const prevStep = () => {
    setCurrentStepIdx((idx) => Math.max(0, idx - 1));
  };

  return (
    <div
      className="modal-backdrop showcase-backdrop"
      role="dialog"
      aria-label="Welcome Showcase & Feature Tour"
      onClick={onClose}
    >
      <div
        className="modal-card showcase-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Showcase Header */}
        <div className="showcase-header">
          <div className="showcase-header-left">
            <span className="instrument-badge">{currentStep.badge}</span>
            <span className="showcase-step-indicator">
              Step {currentStepIdx + 1} of {steps.length}
            </span>
          </div>
          <button
            type="button"
            className="btn-quiet showcase-close-btn"
            onClick={onClose}
            title="Close tour (Esc)"
          >
            Skip Tour ×
          </button>
        </div>

        {/* Step Content Grid */}
        <div className="showcase-body-grid">
          {/* Left Column: Descriptive Guidance */}
          <div className="showcase-info-col">
            <div className="showcase-title-row">
              <span className="showcase-step-icon">{currentStep.icon}</span>
              <div>
                <h2>{currentStep.title}</h2>
                <p className="showcase-subtitle">{currentStep.subtitle}</p>
              </div>
            </div>

            <div className="showcase-bullets-list">
              {currentStep.bullets.map((b, i) => (
                <div key={i} className="showcase-bullet-item">
                  <div className="showcase-bullet-dot" />
                  <div className="showcase-bullet-content">
                    <div className="showcase-bullet-head">
                      <strong>{b.title}</strong>
                      {b.shortcut && <kbd>{b.shortcut}</kbd>}
                    </div>
                    <p>{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {currentStep.actionButton && (
              <div className="showcase-action-wrap">
                <button
                  type="button"
                  className="btn-primary showcase-interactive-btn"
                  onClick={currentStep.actionButton.onClick}
                >
                  {currentStep.actionButton.label}
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Visual Preview Mockup */}
          <div className="showcase-preview-col">
            <div className="showcase-mockup-frame">
              <div className="showcase-mockup-topbar">
                <span className="mockup-dot red" />
                <span className="mockup-dot yellow" />
                <span className="mockup-dot green" />
                <span className="mockup-tag">{currentStep.visualPreview.tag}</span>
              </div>

              <div className="showcase-mockup-canvas">
                {currentStep.visualPreview.type === 'philosophy' && (
                  <div className="mockup-stage mockup-philosophy">
                    <div className="mockup-banner">
                      <strong>Reader-First Hierarchy</strong>
                    </div>
                    <div className="mockup-flow-row">
                      <div className="mockup-flow-card primary">
                        <span className="flow-step-num">1</span>
                        <h4>The Textbook</h4>
                        <p>Continuous reading in the center column.</p>
                      </div>
                      <span className="flow-arrow">→</span>
                      <div className="mockup-flow-card secondary">
                        <span className="flow-step-num">2</span>
                        <h4>Your Mental Effort</h4>
                        <p>Pre-guesses, free recall & concept maps.</p>
                      </div>
                      <span className="flow-arrow">→</span>
                      <div className="mockup-flow-card tertiary">
                        <span className="flow-step-num">3</span>
                        <h4>Comparison & Diff</h4>
                        <p>AI feedback and reference checks unlock.</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep.visualPreview.type === 'reading' && (
                  <div className="mockup-stage mockup-reading">
                    <div className="mockup-prose-block">
                      <span className="mockup-label-p">§2.1 p. 12</span>
                      <p>
                        In experimental trials examining spaced retrieval practice, subjects
                        who engaged in active retrieval testing retained 80% of key conceptual
                        associations after one week, compared to only 34% in repeated-study controls...
                      </p>
                      <div className="mockup-inline-crop">
                        <span>Figure 2: Memory Retention Curves over 21-Day Interval</span>
                        <div className="mockup-crop-box">[Visual PDF Page Crop]</div>
                      </div>
                    </div>
                    <div className="mockup-margin-block">
                      <div className="mockup-margin-card highlight">
                        <span className="m-card-badge">Highlight</span>
                        <p>“active retrieval testing retained 80% of conceptual associations”</p>
                      </div>
                      <div className="mockup-margin-card note">
                        <span className="m-card-badge">Note · p. 12</span>
                        <p>Large effect size (d = 1.26): retrieval effort drives consolidation.</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep.visualPreview.type === 'prequestions' && (
                  <div className="mockup-stage mockup-prequestions">
                    <div className="mockup-pq-box">
                      <span className="pq-badge">Pre-Question before §2.1</span>
                      <p className="pq-q">
                        Predict the 1-week retention difference between passive re-reading vs. active self-testing.
                      </p>
                      <div className="pq-input-mock">
                        Your Guess: “Active self-testing will retain ~2x more material.”
                      </div>
                    </div>
                    <div className="mockup-pq-resurface">
                      <span className="resurface-tag">Resurfaces in Margin at p. 12</span>
                      <div className="resurface-bubble">
                        <strong>Your Guess:</strong> “~2x more material”
                        <p className="resurface-match">✓ Matches findings: 80% vs 34% (+135% gain)</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep.visualPreview.type === 'recall_map' && (
                  <div className="mockup-stage mockup-recall-map">
                    <div className="mockup-map-nodes">
                      <div className="m-node n1">Spaced Retrieval</div>
                      <div className="m-arrow">──(mitigates)──►</div>
                      <div className="m-node n2">Forgetting Curve</div>
                    </div>
                    <div className="mockup-diff-pill">
                      <span className="diff-check">✓ 3 Concepts Recalled</span>
                      <span className="diff-gap">◌ 1 Missing Link Highlighted</span>
                    </div>
                  </div>
                )}

                {currentStep.visualPreview.type === 'lab' && (
                  <div className="mockup-stage mockup-lab">
                    <div className="mockup-lab-header">
                      <span>Model: R(t) = exp( -t / (S · N^0.8) )</span>
                      <span className="mockup-cert-pass">✓ Verified Benchmark</span>
                    </div>
                    <div className="mockup-slider-row">
                      <label>Spacing Factor (S): <strong>2.5</strong></label>
                      <div className="mockup-slider-bar"><div className="mockup-slider-fill" style={{ width: '65%' }} /></div>
                    </div>
                    <div className="mockup-gate-row">
                      <span>Prediction Gate:</span>
                      <span className="m-btn-pred active">Higher Retention ↑</span>
                    </div>
                  </div>
                )}

                {currentStep.visualPreview.type === 'shortcuts_library' && (
                  <div className="mockup-stage mockup-shortcuts">
                    <div className="shortcuts-showcase-row">
                      <kbd>[</kbd> <kbd>]</kbd> <span>Previous / Next Section</span>
                    </div>
                    <div className="shortcuts-showcase-row">
                      <kbd>J</kbd> <kbd>K</kbd> <span>Smooth Scroll Passage</span>
                    </div>
                    <div className="shortcuts-showcase-row">
                      <kbd>H</kbd> <span>Highlight Selection</span>
                    </div>
                    <div className="shortcuts-showcase-row">
                      <kbd>F</kbd> <span>Close Book (Blur for Recall)</span>
                    </div>
                    <div className="shortcuts-showcase-row">
                      <kbd>?</kbd> <span>Full Shortcuts Cheatsheet</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Showcase Footer Stepper */}
        <div className="showcase-footer">
          <div className="showcase-step-dots">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`showcase-dot ${idx === currentStepIdx ? 'active' : ''} ${
                  idx < currentStepIdx ? 'completed' : ''
                }`}
                onClick={() => setCurrentStepIdx(idx)}
                title={`Go to step ${idx + 1}: ${s.title}`}
              />
            ))}
          </div>

          <div className="showcase-nav-btns">
            <button
              type="button"
              className="btn-quiet"
              onClick={prevStep}
              disabled={isFirstStep}
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={nextStep}
            >
              {isLastStep ? 'Start Reading in Margin →' : 'Next Step →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
