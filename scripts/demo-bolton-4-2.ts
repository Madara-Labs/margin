#!/usr/bin/env npx tsx
// ============================================================================
// Demo Walkthrough Script: Bolton & Dewatripont (2005), Chapter 4, §4.2
// "Linear Contracts, Normally Distributed Performance, and Exponential Utility"
// Run with: npm run demo:bolton
// ============================================================================

import {
  BOLTON_4_2_KEY_IDEAS,
  BOLTON_4_2_LAB_SPEC,
  BOLTON_4_2_PRE_QUESTIONS,
  BOLTON_BOOK_STRUCTURE,
  BOLTON_CH4_REFERENCE_MAP,
} from '../src/data/boltonSeed';
import { evaluateLabFormulas, verifyLabSpec } from '../src/lib/labVerifier';
import {
  computeRetrievalMapDiff,
  evaluateFreeRecallCoverage,
} from '../src/lib/recallEvaluator';
import {
  advanceRevisitItem,
  buildOrUpdateRevisitItem,
  interleaveRevisitQueue,
} from '../src/lib/revisitScheduler';

function banner(title: string) {
  console.log(`\n${'='.repeat(76)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(76)}`);
}

function main() {
  banner('MARGIN DEMO WALKTHROUGH — BOLTON & DEWATRIPONT (2005), CH. 4, §4.2');

  const sec42 = BOLTON_BOOK_STRUCTURE.sections.find((s) => s.id === '4.2')!;
  console.log(
    `Book: ${BOLTON_BOOK_STRUCTURE.title} — ${BOLTON_BOOK_STRUCTURE.authors}`
  );
  console.log(
    `Active Section: §${sec42.number} "${sec42.title}" (Book pp. ${sec42.startPage}–${sec42.endPage}, PDF pp. ${sec42.pdfStartPage}–${sec42.pdfEndPage})`
  );
  console.log(
    `Ingested Structure: ${sec42.paragraphs.length} paragraphs, ${sec42.equations.length} LaTeX equations, ${sec42.tables.length} tables, ${sec42.workedExamples.length} worked example.`
  );

  // --------------------------------------------------------------------------
  // STEP 1: Method 1 — Pre-Questions (Pretesting Effect)
  // --------------------------------------------------------------------------
  banner('STEP 1 · METHOD 1: PRE-QUESTIONS (GUESS BEFORE READING)');
  const readerGuesses = [
    'Risk premium probably grows with s^2 and sigma^2 because variance of s*q is s^2 * sigma^2.',
    'Fixed wage t just shifts guaranteed wealth; under CARA there is no income effect on effort.',
    'Higher noise sigma^2 makes incentives riskier, so the optimal piece rate s* must fall.',
  ];
  BOLTON_4_2_PRE_QUESTIONS.forEach((pq, i) => {
    console.log(`\n[Pre-Question ${i + 1}] (Anchored to p. ${pq.anchor.page}, para ${pq.targetParagraphId}):`);
    console.log(`  Q: ${pq.question}`);
    console.log(`  Reader 1-line Guess: "${readerGuesses[i]}"`);
    console.log(`  -> Resurfaces in right margin beside ${pq.anchor.excerptShort}`);
  });

  // --------------------------------------------------------------------------
  // STEP 2: Method 5 — Explorable Model with Mandatory Verification & Predict-First
  // --------------------------------------------------------------------------
  banner('STEP 2 · METHOD 5: EXPLORABLE LAB & MANDATORY VERIFICATION CERTIFICATE');
  const cert = verifyLabSpec(BOLTON_4_2_LAB_SPEC);
  console.log(`Lab ID: ${BOLTON_4_2_LAB_SPEC.id} | Verified: ${cert.passed ? 'PASSED ✓' : 'FAILED ✗'}`);
  for (const line of cert.trace) {
    console.log(`  • ${line}`);
  }

  const benchmarkParams = { c: 1.0, eta: 2.0, sigma: 0.5, wbar: 0.0 };
  const out = evaluateLabFormulas(BOLTON_4_2_LAB_SPEC, benchmarkParams);
  console.log('\nBenchmark Check for (c = 1, η = 2, σ = 0.5, w̄ = 0):');
  console.log(`  • Optimal Piece Rate s*      = ${out.s_star.toFixed(6)}  (exact 2/3 = ${(2 / 3).toFixed(6)})`);
  console.log(`  • Second-Best Effort a*      = ${out.a_star.toFixed(6)}  (exact 2/3 = ${(2 / 3).toFixed(6)})`);
  console.log(`  • Second-Best Profit Π_SB    = ${out.pi_sb.toFixed(6)}  (exact 1/3 = ${(1 / 3).toFixed(6)})`);
  console.log(`  • First-Best Profit Π_FB     = ${out.pi_fb.toFixed(6)}  (exact 1/2 = 0.500000)`);

  console.log('\nPredict-First Slider Simulation (Increasing noise σ: 0.50 -> 1.00):');
  console.log('  Reader commits prediction: Second-best profit Π_SB goes DOWN ↓');
  const afterNoiseIncrease = evaluateLabFormulas(BOLTON_4_2_LAB_SPEC, {
    ...benchmarkParams,
    sigma: 1.0,
  });
  console.log(
    `  Actual Result: s* drops ${out.s_star.toFixed(4)} -> ${afterNoiseIncrease.s_star.toFixed(4)} (1/3), Π_SB drops ${out.pi_sb.toFixed(4)} -> ${afterNoiseIncrease.pi_sb.toFixed(4)} (1/6). Prediction MATCHED ✓`
  );

  // Verify that a deliberately broken model is caught and blocked
  const brokenCert = verifyLabSpec({
    ...BOLTON_4_2_LAB_SPEC,
    formulas: BOLTON_4_2_LAB_SPEC.formulas.map((f) =>
      f.name === 's_star' ? { ...f, expression: '1 / (1 + eta * c * sigma)' } : f
    ),
  });
  console.log(
    `\nDeliberately Wrong Formula Check (omitting square on σ): Verified = ${brokenCert.passed} (Blocked with reason: "${brokenCert.failureReasons[0]}")`
  );

  // --------------------------------------------------------------------------
  // STEP 3: Method 2 — Free Recall at Section End (Book Blurred -> Comparison)
  // --------------------------------------------------------------------------
  banner('STEP 3 · METHOD 2: FREE RECALL AT SECTION END (SIDE-BY-SIDE COVERAGE)');
  const sampleReaderRecall =
    'Performance is q = a + noise with normal variance sigma^2 and linear contract w = t + s*q. ' +
    'Because the agent has CARA utility and quadratic cost c*a^2/2, the certainty equivalent is ' +
    't + s*a - c*a^2/2 - 0.5*eta*s^2*sigma^2. The IC condition gives a = s/c. ' +
    'Maximizing expected profit subject to binding IR yields optimal slope s* = 1 / (1 + eta*c*sigma^2).';

  console.log(`Reader Free Recall Attempt (written while page is blurred):\n  "${sampleReaderRecall}"\n`);
  const coverage = evaluateFreeRecallCoverage(sampleReaderRecall, BOLTON_4_2_KEY_IDEAS);
  for (const cov of coverage) {
    const ki = BOLTON_4_2_KEY_IDEAS.find((k) => k.id === cov.ideaId)!;
    const badge = cov.status === 'covered' ? '✓ COVERED' : cov.status === 'partial' ? '◐ PARTIAL' : '○ GAP    ';
    console.log(`  [${badge}] (Jump -> p.${ki.anchor.page}) ${ki.idea}`);
  }

  // --------------------------------------------------------------------------
  // STEP 4: Method 3 — Retrieval Map (From Memory -> Reference Diff Overlay)
  // --------------------------------------------------------------------------
  banner('STEP 4 · METHOD 3: RETRIEVAL MAP & REFERENCE DIFF OVERLAY');
  const readerNodes = [
    { id: 'rn-1', label: 'Linear Contract w = t + sq', x: 100, y: 100 },
    { id: 'rn-2', label: 'Certainty Equivalent ŵ(a) & Risk Premium', x: 300, y: 100 },
    { id: 'rn-3', label: 'Agent IC Constraint: a* = s / c', x: 100, y: 220 },
    { id: 'rn-4', label: 'Second-Best Slope s* = 1 / (1 + ηcσ²)', x: 300, y: 220 },
  ];
  const readerEdges = [
    { id: 're-1', source: 'rn-1', target: 'rn-2', label: 'induces risk exposure' },
    { id: 're-2', source: 'rn-2', target: 'rn-3', label: 'FOC in effort a' },
    { id: 're-3', source: 'rn-3', target: 'rn-4', label: 'balances incentives vs risk' },
  ];
  const mapDiff = computeRetrievalMapDiff(readerNodes, readerEdges, BOLTON_CH4_REFERENCE_MAP);
  console.log(
    `Reader Map: ${readerNodes.length} nodes, ${readerEdges.length} directed links.`
  );
  console.log(
    `Diff vs. Chapter 4 Reference Map: ${mapDiff.matchedNodeIds.length}/${BOLTON_CH4_REFERENCE_MAP.nodes.length} nodes matched, ${mapDiff.missingReferenceNodes.length} missing reference nodes surfaced with page links:`
  );
  for (const missing of mapDiff.missingReferenceNodes) {
    console.log(`  • Missing Node: "${missing.label}" -> Source: p. ${missing.anchor?.page}`);
  }

  // --------------------------------------------------------------------------
  // STEP 5: Method 10 — Spaced Revisits (1, 3, 7, 21 days, Interleaved)
  // --------------------------------------------------------------------------
  banner('STEP 5 · METHOD 10: SPACED REVISIT SCHEDULER (1, 3, 7, 21d INTERLEAVED)');
  let rev42 = buildOrUpdateRevisitItem({
    bookId: 'bolton-2005',
    sectionId: '4.2',
    chapterId: '4',
    sectionTitle: sec42.title,
    gapCount: coverage.filter((c) => c.status !== 'covered').length,
    unansweredPromptsCount: 0,
    nowIso: '2026-10-24T12:00:00.000Z',
  });
  console.log(`Initial schedule for §4.2: interval = ${rev42.intervalDays}d, due = ${rev42.dueAt.slice(0, 10)}`);
  for (let step = 1; step <= 3; step++) {
    rev42 = advanceRevisitItem(rev42, 0, rev42.dueAt);
    console.log(
      `  After revisit #${step} (0 gaps): next interval = ${rev42.intervalDays}d, due = ${rev42.dueAt.slice(0, 10)} (${rev42.recommendedMode})`
    );
  }

  const interleaved = interleaveRevisitQueue([
    rev42,
    buildOrUpdateRevisitItem({
      bookId: 'bolton-2005',
      sectionId: '4.1',
      chapterId: '4',
      sectionTitle: 'Two Performance Outcomes',
      gapCount: 1,
      unansweredPromptsCount: 0,
      nowIso: rev42.lastAttemptAt,
    }),
    buildOrUpdateRevisitItem({
      bookId: 'bolton-2005',
      sectionId: '2.1',
      chapterId: '2',
      sectionTitle: 'Adverse Selection Screening',
      gapCount: 2,
      unansweredPromptsCount: 0,
      nowIso: rev42.lastAttemptAt,
    }),
  ]);
  console.log(
    `Interleaved Queue Order across Chapters: ${interleaved.map((i) => `Ch.${i.chapterId}(§${i.sectionId})`).join(' -> ')}`
  );
  console.log('\nWalkthrough complete.\n');
}

main();
