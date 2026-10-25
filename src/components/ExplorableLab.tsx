// ============================================================================
// Method 5: Explorable Models (Enacting, Dual Coding, Predict First, Verified)
// Rules:
// 1. Verification is mandatory: verifyLabSpec(spec) runs automatically. If it
//    fails, NEVER show the sliders/chart; show "Couldn't verify this model"
//    with the exact failure reason and allow editing/fixing the spec.
// 2. Predict first: before each slider change takes effect, the reader can
//    commit a prediction ("profit goes up / down / same"), then sees the result.
// 3. Every AI-generated element shows its source anchor and can be edited.
// ============================================================================

import React, { useMemo, useState } from 'react';
import katex from 'katex';
import {
  ExplorableLabSpec,
  SliderPrediction,
} from '../types/margin';
import {
  evaluateChartSeries,
  evaluateLabFormulas,
  verifyLabSpec,
} from '../lib/labVerifier';

interface ExplorableLabProps {
  spec: ExplorableLabSpec;
  predictions: SliderPrediction[];
  onRecordPrediction: (pred: SliderPrediction) => void;
  onUpdateSpec: (updated: ExplorableLabSpec) => void;
  onJumpToAnchor?: (page: number, paragraphId?: string) => void;
}

export const ExplorableLab: React.FC<ExplorableLabProps> = ({
  spec,
  predictions,
  onRecordPrediction,
  onUpdateSpec,
  onJumpToAnchor,
}) => {
  // Run automatic mandatory verification whenever spec changes
  const certificate = useMemo(() => verifyLabSpec(spec), [spec]);

  const [paramValues, setParamValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const p of spec.parameters) {
      init[p.name] = p.defaultValue;
    }
    return init;
  });

  // Reset parameter values whenever the active lab specification changes (e.g. switching books/sections)
  React.useEffect(() => {
    const init: Record<string, number> = {};
    for (const p of spec.parameters) {
      init[p.name] = p.defaultValue;
    }
    setParamValues(init);
    setPendingChange(null);
    setLastFeedback(null);
  }, [spec.id]);

  // Predict-first gate state
  const [predictFirstMode, setPredictFirstMode] = useState<boolean>(true);
  const [pendingChange, setPendingChange] = useState<{
    paramName: string;
    paramSymbol: string;
    fromValue: number;
    toValue: number;
    targetOutput: string;
    targetLabel: string;
  } | null>(null);
  const [lastFeedback, setLastFeedback] = useState<SliderPrediction | null>(
    null
  );

  // Spec editor state (reader can edit formulas or test deliberate failure)
  const [editingSpec, setEditingSpec] = useState<boolean>(false);
  const [showCertDetails, setShowCertDetails] = useState<boolean>(false);

  const currentOutputs = useMemo(() => {
    if (!certificate.passed) return {};
    try {
      return evaluateLabFormulas(spec, paramValues);
    } catch {
      return {};
    }
  }, [certificate.passed, spec, paramValues]);

  const chartData = useMemo(() => {
    if (!certificate.passed) return { xValues: [], seriesData: {} };
    return evaluateChartSeries(spec, paramValues, 61);
  }, [certificate.passed, spec, paramValues]);

  const handleSliderInput = (
    paramName: string,
    paramSymbol: string,
    newVal: number
  ) => {
    const oldVal = paramValues[paramName];
    if (Math.abs(newVal - oldVal) < 1e-9) return;

    if (!predictFirstMode) {
      setParamValues((prev) => ({ ...prev, [paramName]: newVal }));
      return;
    }

    // Commit-a-prediction gate before applying the parameter change
    setPendingChange({
      paramName,
      paramSymbol,
      fromValue: oldVal,
      toValue: newVal,
      targetOutput: 'pi_sb',
      targetLabel: 'Second-best profit (Π_SB)',
    });
  };

  const commitPrediction = (guess: 'up' | 'down' | 'same') => {
    if (!pendingChange) return;
    const beforeOut = evaluateLabFormulas(spec, paramValues);
    const nextParams = {
      ...paramValues,
      [pendingChange.paramName]: pendingChange.toValue,
    };
    const afterOut = evaluateLabFormulas(spec, nextParams);

    const beforeVal = beforeOut[pendingChange.targetOutput] ?? 0;
    const afterVal = afterOut[pendingChange.targetOutput] ?? 0;
    const diff = afterVal - beforeVal;

    const actualDirection: 'up' | 'down' | 'same' =
      Math.abs(diff) < 1e-6 ? 'same' : diff > 0 ? 'up' : 'down';

    const record: SliderPrediction = {
      id: `pred-${Date.now()}`,
      labId: spec.id,
      parameterChanged: `${pendingChange.paramSymbol} (${pendingChange.paramName})`,
      fromValue: pendingChange.fromValue,
      toValue: pendingChange.toValue,
      targetOutput: pendingChange.targetOutput,
      prediction: guess,
      actualDirection,
      beforeOutputValue: beforeVal,
      afterOutputValue: afterVal,
      correct: guess === actualDirection,
      createdAt: new Date().toISOString(),
    };

    setParamValues(nextParams);
    setPendingChange(null);
    setLastFeedback(record);
    onRecordPrediction(record);
  };

  const resetToBoltonBenchmark = () => {
    const bench: Record<string, number> = {};
    for (const p of spec.parameters) {
      bench[p.name] = p.defaultValue;
    }
    setParamValues(bench);
    setPendingChange(null);
  };

  const injectDeliberateFormulaBug = () => {
    // Deliberately drop the square on sigma in s_star so the reader can see
    // mandatory verification block the unverified lab
    const corrupted: ExplorableLabSpec = {
      ...spec,
      editedByReader: true,
      formulas: spec.formulas.map((f) =>
        f.name === 's_star'
          ? { ...f, expression: '1 / (1 + 2 * eta * c * sigma)' }
          : f
      ),
    };
    onUpdateSpec(corrupted);
  };

  const restoreVerifiedFormula = () => {
    const restored: ExplorableLabSpec = {
      ...spec,
      editedByReader: true,
      formulas: spec.formulas.map((f) =>
        f.name === 's_star'
          ? { ...f, expression: '1 / (1 + eta * c * sigma^2)' }
          : f
      ),
    };
    onUpdateSpec(restored);
  };

  // Render SVG Chart
  const renderSvgChart = () => {
    const { xValues, seriesData } = chartData;
    if (xValues.length === 0) return null;

    const width = 540;
    const height = 240;
    const padL = 48;
    const padR = 20;
    const padT = 18;
    const padB = 36;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const xMin = spec.chart.xMin;
    const xMax = spec.chart.xMax;
    const yMin = 0;
    const yMax = Math.max(
      0.65,
      ...Object.values(seriesData).flatMap((arr) => arr)
    );

    const toX = (x: number) =>
      padL + ((x - xMin) / Math.max(1e-6, xMax - xMin)) * plotW;
    const toY = (y: number) =>
      padT + plotH - ((y - yMin) / Math.max(1e-6, yMax - yMin)) * plotH;

    const optXKey = currentOutputs.s_star !== undefined ? 's_star' : 'q_star';
    const optXSym = currentOutputs.s_star !== undefined ? 's*' : 'q*';
    const optXVal = currentOutputs[optXKey] ?? 0;
    const piSb = currentOutputs.pi_sb ?? 0;
    const xTicks = [0, 0.25, 0.5, 0.75, 1.0].map(
      (f) => xMin + f * (xMax - xMin)
    );

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="lab-chart-svg"
        role="img"
        aria-label={spec.title}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
          const yVal = yMin + frac * (yMax - yMin);
          const yPos = toY(yVal);
          return (
            <g key={frac}>
              <line
                x1={padL}
                y1={yPos}
                x2={width - padR}
                y2={yPos}
                stroke="currentColor"
                strokeOpacity={0.12}
              />
              <text
                x={padL - 6}
                y={yPos + 4}
                textAnchor="end"
                fontSize="10"
                fill="currentColor"
                opacity={0.65}
              >
                {yVal.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* X axis ticks */}
        {xTicks.map((xv) => (
          <g key={xv}>
            <line
              x1={toX(xv)}
              y1={padT + plotH}
              x2={toX(xv)}
              y2={padT + plotH + 4}
              stroke="currentColor"
              strokeOpacity={0.4}
            />
            <text
              x={toX(xv)}
              y={height - 14}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              opacity={0.7}
            >
              {xv.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text
          x={padL + plotW / 2}
          y={height - 2}
          textAnchor="middle"
          fontSize="11"
          fill="currentColor"
          opacity={0.8}
        >
          {spec.chart.xLabel}
        </text>

        {/* Series paths */}
        {spec.chart.series.map((s) => {
          const pts = seriesData[s.key] || [];
          const d = pts
            .map((yv, idx) => {
              const xp = toX(xValues[idx]);
              const yp = toY(Math.max(yMin, Math.min(yMax, yv)));
              return `${idx === 0 ? 'M' : 'L'} ${xp.toFixed(1)} ${yp.toFixed(1)}`;
            })
            .join(' ');
          return (
            <path
              key={s.key}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={2.2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
            />
          );
        })}

        {/* Optimal choice marker */}
        {optXVal >= xMin && optXVal <= xMax && (
          <g>
            <line
              x1={toX(optXVal)}
              y1={padT}
              x2={toX(optXVal)}
              y2={padT + plotH}
              stroke="#2563eb"
              strokeWidth={1.2}
              strokeDasharray="3 3"
            />
            <circle
              cx={toX(optXVal)}
              cy={toY(Math.max(0, piSb))}
              r={5}
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
            <text
              x={Math.min(width - 95, toX(optXVal) + 8)}
              y={Math.max(padT + 14, toY(Math.max(0, piSb)) - 8)}
              fontSize="11"
              fontWeight="600"
              fill="#2563eb"
            >
              {optXSym}={optXVal.toFixed(3)}, Π={piSb.toFixed(3)}
            </text>
          </g>
        )}
      </svg>
    );
  };

  return (
    <section className="instrument-card lab-instrument" aria-label="Explorable Model">
      <div className="instrument-header">
        <div>
          <span className="instrument-badge">Method 5 · Explorable Model (Enacting & Dual Coding)</span>
          <h3 className="instrument-title">{spec.title}</h3>
          <p className="instrument-subtitle">{spec.subtitle}</p>
        </div>
        <div className="instrument-meta-actions">
          <button
            type="button"
            className="anchor-pill"
            onClick={() => onJumpToAnchor?.(spec.anchor.page, spec.anchor.paragraphId)}
            title="Jump to source location in book"
          >
            Source: §{spec.sectionId}, p. {spec.anchor.page}
          </button>
          <button
            type="button"
            className={`cert-badge ${certificate.passed ? 'cert-pass' : 'cert-fail'}`}
            onClick={() => setShowCertDetails((v) => !v)}
          >
            {certificate.passed
              ? `✓ Verified Certificate (${certificate.checks.length}/${certificate.checks.length} checks)`
              : `✗ Verification Failed`}
          </button>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => setEditingSpec((v) => !v)}
          >
            {editingSpec ? 'Close Spec Editor' : 'Edit Spec / Test Verifier'}
          </button>
        </div>
      </div>

      {/* Certificate inspection drawer */}
      {showCertDetails && (
        <div className="certificate-drawer">
          <div className="certificate-drawer-header">
            <strong>Mandatory Verification Certificate (Stored with Lab)</strong>
            <span>Verified at {new Date(certificate.verifiedAt).toLocaleTimeString()}</span>
          </div>
          <ul className="certificate-trace-list">
            {certificate.trace.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          {certificate.kktOrGridResidual !== undefined && (
            <p className="certificate-residual">
              Independent 2,000-point grid solver residual:{' '}
              <code>{certificate.kktOrGridResidual.toExponential(2)}</code>
            </p>
          )}
        </div>
      )}

      {/* Formula Spec Editor (every AI-generated instrument is editable by the reader) */}
      {editingSpec && (
        <div className="spec-editor-panel">
          <div className="spec-editor-top">
            <strong>Typed Formula Specification (Evaluated via math.js — never eval)</strong>
            <div className="spec-editor-buttons">
              <button
                type="button"
                className="btn-quiet btn-warn-outline"
                onClick={injectDeliberateFormulaBug}
              >
                Simulate Wrong Formula (Test Verification Gate)
              </button>
              <button
                type="button"
                className="btn-quiet"
                onClick={restoreVerifiedFormula}
              >
                Restore Correct §4.2 Formula
              </button>
            </div>
          </div>
          <div className="spec-formula-grid">
            {spec.formulas.map((f, idx) => (
              <div key={f.name} className="spec-formula-row">
                <label>{f.symbol} ({f.name}):</label>
                <input
                  type="text"
                  value={f.expression}
                  onChange={(e) => {
                    const nextFormulas = [...spec.formulas];
                    nextFormulas[idx] = { ...f, expression: e.target.value };
                    onUpdateSpec({ ...spec, editedByReader: true, formulas: nextFormulas });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MANDATORY VERIFICATION GATE: If verification fails, do NOT show the interactive lab */}
      {!certificate.passed ? (
        <div className="verification-blocked-banner" role="alert">
          <h4>Couldn’t verify this model</h4>
          <p>
            Margin blocks interactive labs that fail to reproduce the section’s worked numeric
            examples or violate domain assumptions:
          </p>
          <ul>
            {certificate.failureReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-primary"
            onClick={restoreVerifiedFormula}
          >
            Restore Verified Bolton §4.2 Specification
          </button>
        </div>
      ) : (
        <>
          {/* Predict-first toggle and benchmark reset */}
          <div className="lab-controls-bar">
            <label className="predict-toggle-label">
              <input
                type="checkbox"
                checked={predictFirstMode}
                onChange={(e) => setPredictFirstMode(e.target.checked)}
              />
              <span>
                <strong>Predict-First Mode:</strong> commit a directional prediction before each slider change takes effect
              </span>
            </label>
            <button
              type="button"
              className="btn-quiet"
              onClick={resetToBoltonBenchmark}
            >
              Reset to Benchmark (c=1, η=2, σ=0.5)
            </button>
          </div>

          {/* Pending Prediction Gate Modal/Banner */}
          {pendingChange && (
            <div className="prediction-gate-card" role="region" aria-label="Predict First Prompt">
              <div className="prediction-gate-question">
                <strong>Predict First:</strong> You are changing{' '}
                <code>{pendingChange.paramSymbol}</code> from{' '}
                <strong>{pendingChange.fromValue}</strong> to{' '}
                <strong>{pendingChange.toValue}</strong>. What will happen to{' '}
                <strong>{pendingChange.targetLabel}</strong> (and optimal piece rate <code>s*</code>)?
              </div>
              <div className="prediction-gate-buttons">
                <button
                  type="button"
                  className="btn-predict"
                  onClick={() => commitPrediction('up')}
                >
                  ↑ Goes Up
                </button>
                <button
                  type="button"
                  className="btn-predict"
                  onClick={() => commitPrediction('down')}
                >
                  ↓ Goes Down
                </button>
                <button
                  type="button"
                  className="btn-predict"
                  onClick={() => commitPrediction('same')}
                >
                  = Stays Same
                </button>
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => setPendingChange(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Immediate Comparison Result after Prediction */}
          {lastFeedback && !pendingChange && (
            <div
              className={`prediction-feedback-pill ${
                lastFeedback.correct ? 'pred-correct' : 'pred-mismatch'
              }`}
            >
              <span>
                {lastFeedback.correct ? '✓ Prediction matched:' : '↻ Productive comparison:'}{' '}
                When <strong>{lastFeedback.parameterChanged}</strong> moved{' '}
                {lastFeedback.fromValue} → {lastFeedback.toValue},{' '}
                <code>{lastFeedback.targetOutput}</code> went{' '}
                <strong>{lastFeedback.actualDirection.toUpperCase()}</strong> (
                {lastFeedback.beforeOutputValue.toFixed(4)} →{' '}
                {lastFeedback.afterOutputValue.toFixed(4)}; you predicted{' '}
                <em>{lastFeedback.prediction}</em>).
              </span>
              <button
                type="button"
                className="btn-dismiss"
                onClick={() => setLastFeedback(null)}
              >
                ×
              </button>
            </div>
          )}

          <div className="lab-main-grid">
            {/* Parameter Sliders */}
            <div className="lab-sliders-col">
              <h4>Parameters</h4>
              {spec.parameters.map((p) => {
                const val = paramValues[p.name] ?? p.defaultValue;
                return (
                  <div key={p.name} className="slider-row">
                    <div className="slider-label-line">
                      <span>{p.label}</span>
                      <code className="slider-val-badge">
                        {p.symbol} = {val.toFixed(2)}
                      </code>
                    </div>
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={val}
                      onChange={(e) =>
                        handleSliderInput(p.name, p.symbol, parseFloat(e.target.value))
                      }
                    />
                    <div className="slider-range-hints">
                      <span>{p.min}</span>
                      <span>{p.max}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Chart + Readouts */}
            <div className="lab-chart-col">
              <div className="lab-readouts-grid">
                {spec.formulas.slice(0, 4).map((f) => {
                  const val = currentOutputs[f.name];
                  const fractHint =
                    val !== undefined && Math.abs(val - 2 / 3) < 1e-4
                      ? ' (2/3)'
                      : val !== undefined && Math.abs(val - 1 / 3) < 1e-4
                        ? ' (1/3)'
                        : val !== undefined && Math.abs(val - 0.5) < 1e-4
                          ? ' (1/2)'
                          : '';
                  return (
                    <div key={f.name} className="readout-box" title={f.description}>
                      <span className="readout-label">{f.label}</span>
                      <strong className="readout-value">
                        {val !== undefined ? val.toFixed(4) : '—'}
                        <small>{fractHint}</small>
                      </strong>
                      {f.latex && (
                        <span
                          className="readout-formula-tex"
                          dangerouslySetInnerHTML={{
                            __html: katex.renderToString(f.latex, {
                              throwOnError: false,
                            }),
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="lab-svg-wrapper">
                {renderSvgChart()}
                <div className="chart-legend">
                  {spec.chart.series.map((s) => (
                    <span key={s.key} className="legend-item">
                      <span
                        className="legend-swatch"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="lab-scope-footnote">
            <strong>Scope & Boundary Note:</strong> {spec.scopeNote}
            {predictions.length > 0 && (
              <span>
                {' '}
                · Predictions logged this session: {predictions.length} (
                {predictions.filter((p) => p.correct).length} exact).
              </span>
            )}
          </p>
        </>
      )}
    </section>
  );
};
