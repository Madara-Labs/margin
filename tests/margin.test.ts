import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseDocumentStructure } from '../src/lib/ingestionParser';
import { verifyLabSpec, evaluateLabFormulas, evaluateChartSeries } from '../src/lib/labVerifier';
import { OPENSTAX_8_2_LAB_SPEC } from '../src/data/openstaxSeed';
import {
  buildOrUpdateRevisitItem,
  advanceRevisitItem,
  interleaveRevisitQueue,
  REVISIT_INTERVALS,
} from '../src/lib/revisitScheduler';
import { ExplorableLabSpec } from '../src/types/margin';
import { BOLTON_BOOK_STRUCTURE, BOLTON_1_1_PRE_QUESTIONS } from '../src/data/boltonSeed';

describe('1. Ingestion Parser (OpenStax CC-BY Economics Fixture)', () => {
  const fixturePath = path.resolve(
    __dirname,
    '../fixtures/openstax_economics_ch8.md'
  );
  const rawText = fs.readFileSync(fixturePath, 'utf-8');
  const parsed = parseDocumentStructure(rawText, {
    bookId: 'openstax-econ-3e',
    title: 'Principles of Economics 3e',
    authors: 'OpenStax / Rice University',
    license: 'CC-BY 4.0',
  });

  it('extracts TOC entries and section boundaries with page anchors', () => {
    expect(parsed.toc.length).toBeGreaterThanOrEqual(6);
    expect(parsed.sections.map((s) => s.id)).toEqual(['7.1', '8.2', '8.3']);
    const sec82 = parsed.sections.find((s) => s.id === '8.2')!;
    expect(sec82.title).toContain('How Perfectly Competitive Firms Make Output Decisions');
    expect(sec82.startPage).toBe(192);
  });

  it('extracts LaTeX equations with labels and page numbers', () => {
    const sec82 = parsed.sections.find((s) => s.id === '8.2')!;
    expect(sec82.equations.length).toBe(3);
    expect(sec82.equations[0].label).toBe('(8.1)');
    expect(sec82.equations[0].latex).toContain('TC(q) = F + c_1 q');
    expect(sec82.equations[2].label).toBe('(8.3)');
    expect(sec82.equations[2].latex).toContain('q^* = \\frac{P - c_1}{c_2}');
  });

  it('extracts tables and worked numeric examples', () => {
    const sec82 = parsed.sections.find((s) => s.id === '8.2')!;
    expect(sec82.tables.length).toBe(1);
    expect(sec82.tables[0].headers).toContain('Marginal Cost (MC)');
    expect(sec82.tables[0].rows.length).toBe(6);

    expect(sec82.workedExamples.length).toBe(1);
    expect(sec82.workedExamples[0].parameters.P).toBe(4);
    expect(sec82.workedExamples[0].expectedOutputs['Pi^*']).toBe(6.0);
  });

  it('keeps multi-line section headings intact and strips top-of-page running headers like "5 Introduction"', () => {
    const sampleBoltonExtract = [
      '=== PAGE 6 ===',
      'Contents',
      '1 Introduction 1',
      '1.1 Optimal Employment Contracts without Uncertainty, Hidden',
      'Information, or Hidden Actions 4',
      '=== PAGE 21 ===',
      '4 Introduction',
      '1.1 Optimal Employment Contracts without Uncertainty, Hidden Information,',
      'or Hidden Actions',
      'Consider the following standard bilateral contracting problem between an employer and employee.',
      '=== PAGE 22 ===',
      '5 Introduction',
      'Both individuals could decide not to trade, in which case they would each achieve reservation utility.',
    ].join('\n');

    const res = parseDocumentStructure(sampleBoltonExtract, {
      bookId: 'bolton-sample',
      title: 'Contract Theory',
      authors: 'Bolton & Dewatripont',
    });

    const sec11 = res.sections.find((s) => s.id === '1.1')!;
    expect(sec11).toBeDefined();
    expect(sec11.title).toBe(
      'Optimal Employment Contracts without Uncertainty, Hidden Information, or Hidden Actions'
    );
    expect(sec11.paragraphs[0].text).toBe(
      'Consider the following standard bilateral contracting problem between an employer and employee.'
    );
    expect(sec11.paragraphs[0].text).not.toContain('or Hidden Actions');
    expect(sec11.paragraphs[1].text).toBe(
      'Both individuals could decide not to trade, in which case they would each achieve reservation utility.'
    );
    expect(sec11.paragraphs[1].text).not.toContain('5 Introduction');
    expect(sec11.paragraphs[1].page).toBe(5);
  });
});

describe('2. Explorable Model Verification Engine (Bolton §4.2 Linear-CARA Moral Hazard)', () => {
  const bolton42Spec: ExplorableLabSpec = {
    id: 'lab-bolton-4-2',
    sectionId: '4.2',
    title: 'Linear-CARA-Normal Moral Hazard Lab (Bolton §4.2)',
    subtitle: 'w = t + s·q, q = a + ε, ε ~ N(0, σ²), u(w,a) = -exp(-η[w - c·a²/2])',
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '4.2',
      page: 137,
      pdfPage: 152,
      excerptShort: 'Bolton & Dewatripont (2005), Ch. 4, §4.2, pp. 137–139',
    },
    parameters: [
      { name: 'c', symbol: 'c', label: 'Effort cost coefficient', min: 0.2, max: 5.0, step: 0.1, defaultValue: 1.0 },
      { name: 'eta', symbol: 'η', label: 'Agent CARA risk aversion', min: 0.1, max: 5.0, step: 0.1, defaultValue: 2.0 },
      { name: 'sigma', symbol: 'σ', label: 'Output noise std dev', min: 0.1, max: 2.0, step: 0.05, defaultValue: 0.5 },
      { name: 'wbar', symbol: 'w̄', label: 'Reservation certainty equivalent', min: 0.0, max: 1.0, step: 0.05, defaultValue: 0.0 },
    ],
    formulas: [
      {
        name: 's_star',
        symbol: 's*',
        label: 'Second-best piece rate (s*)',
        expression: '1 / (1 + eta * c * sigma^2)',
        latex: 's^* = \\frac{1}{1 + \\eta c \\sigma^2}',
      },
      {
        name: 'a_star',
        symbol: 'a*',
        label: 'Second-best effort (a*)',
        expression: 's_star / c',
        latex: 'a^* = \\frac{s^*}{c}',
      },
      {
        name: 'pi_sb',
        symbol: 'Π_SB',
        label: 'Second-best principal profit',
        expression: '1 / (2 * c * (1 + eta * c * sigma^2)) - wbar',
        latex: '\\Pi^{SB} = \\frac{1}{2c(1 + \\eta c \\sigma^2)} - \\bar{w}',
      },
      {
        name: 'pi_fb',
        symbol: 'Π_FB',
        label: 'First-best principal profit',
        expression: '1 / (2 * c) - wbar',
        latex: '\\Pi^{FB} = \\frac{1}{2c} - \\bar{w}',
      },
      {
        name: 'agency_cost',
        symbol: 'ΔΠ',
        label: 'Agency loss (Π_FB - Π_SB)',
        expression: 'pi_fb - pi_sb',
      },
    ],
    chart: {
      xVariable: 's',
      xLabel: 'Incentive slope s',
      xMin: 0,
      xMax: 1,
      yLabel: 'Expected Payoff / Surplus',
      series: [
        {
          key: 'pi_of_s',
          label: 'Principal Expected Profit Π(s)',
          expression: '(s / c) - 0.5 * (s^2 / c) - 0.5 * eta * s^2 * sigma^2 - wbar',
          color: '#2563eb',
        },
        {
          key: 'pi_fb_line',
          label: 'First-Best Benchmark Π_FB',
          expression: '1 / (2 * c) - wbar',
          color: '#16a34a',
          dashed: true,
        },
      ],
    },
    workedExamples: [
      {
        id: 'ex-bolton-4-2-benchmark',
        title: 'Bolton §4.2 Benchmark (c=1, η=2, σ=0.5, w̄=0)',
        anchor: { bookId: 'bolton-2005', sectionId: '4.2', page: 139 },
        inputs: { c: 1.0, eta: 2.0, sigma: 0.5, wbar: 0.0 },
        expected: {
          s_star: 2 / 3,
          a_star: 2 / 3,
          pi_sb: 1 / 3,
          pi_fb: 0.5,
        },
        tolerance: 1e-6,
      },
    ],
    assumptions: [
      { name: 'convex_effort_cost', expression: 'c > 0', description: 'ψ″(a) = c > 0' },
      { name: 'risk_averse_agent', expression: 'eta > 0', description: 'CARA coefficient η > 0' },
      { name: 'positive_noise', expression: 'sigma > 0', description: 'Output noise σ > 0' },
    ],
    scopeNote: 'Optimal within linear contracts w = t + s·q (Holmström & Milgrom, 1987).',
  };

  it('passes verification on a correct Bolton §4.2 spec and matches s*=2/3, pi_sb=1/3, pi_fb=0.5', () => {
    const out = evaluateLabFormulas(bolton42Spec, { c: 1, eta: 2, sigma: 0.5, wbar: 0 });
    expect(out.s_star).toBeCloseTo(2 / 3, 8);
    expect(out.pi_sb).toBeCloseTo(1 / 3, 8);
    expect(out.pi_fb).toBeCloseTo(0.5, 8);

    const cert = verifyLabSpec(bolton42Spec);
    expect(cert.passed).toBe(true);
    expect(cert.failureReasons).toHaveLength(0);
    expect(cert.checks.every((c) => c.passed)).toBe(true);
    expect(cert.kktOrGridResidual).toBeLessThan(1e-3);
  });

  it('fails verification on a deliberately wrong formula and reports the exact reason', () => {
    const brokenSpec: ExplorableLabSpec = {
      ...bolton42Spec,
      id: 'lab-bolton-4-2-broken',
      formulas: bolton42Spec.formulas.map((f) =>
        f.name === 's_star'
          ? { ...f, expression: '1 / (1 + eta * c * sigma)' } // Missing square on sigma!
          : f
      ),
    };

    const cert = verifyLabSpec(brokenSpec);
    expect(cert.passed).toBe(false);
    expect(cert.failureReasons.length).toBeGreaterThan(0);
    expect(cert.failureReasons.join(' ')).toContain('s_star');
  });

  it('safely evaluates chart series when switching between Bolton §4.2 and OpenStax §8.2 specs', () => {
    // Passing Bolton parameter state into OpenStax spec must not throw "Undefined symbol P"
    const chartOut = evaluateChartSeries(OPENSTAX_8_2_LAB_SPEC, { c: 1, eta: 2, sigma: 0.5 });
    expect(chartOut.xValues.length).toBeGreaterThan(0);
    expect(chartOut.seriesData.profit_curve.length).toBe(chartOut.xValues.length);
  });
});

describe('3. Spaced Revisit Scheduler (1, 3, 7, 21 days + Chapter Interleaving)', () => {
  it('progresses intervals across 1, 3, 7, and 21 days when recall gaps are resolved', () => {
    expect(REVISIT_INTERVALS).toEqual([1, 3, 7, 21]);
    const t0 = '2026-10-24T12:00:00.000Z';

    let item = buildOrUpdateRevisitItem({
      bookId: 'bolton-2005',
      sectionId: '4.2',
      chapterId: '4',
      sectionTitle: 'Linear Contracts, Normally Distributed Performance, and Exponential Utility',
      gapCount: 2,
      unansweredPromptsCount: 1,
      nowIso: t0,
    });

    expect(item.intervalDays).toBe(1);
    expect(item.stageIndex).toBe(0);

    // Advance with 0 gaps -> moves to 3 days
    item = advanceRevisitItem(item, 0, item.dueAt);
    expect(item.intervalDays).toBe(3);
    expect(item.stageIndex).toBe(1);

    // Advance with 0 gaps -> moves to 7 days
    item = advanceRevisitItem(item, 0, item.dueAt);
    expect(item.intervalDays).toBe(7);
    expect(item.stageIndex).toBe(2);

    // Advance with 0 gaps -> moves to 21 days
    item = advanceRevisitItem(item, 0, item.dueAt);
    expect(item.intervalDays).toBe(21);
    expect(item.stageIndex).toBe(3);

    // If a gap reappears at stage 3, steps back to stage 2 (7 days)
    item = advanceRevisitItem(item, 2, item.dueAt);
    expect(item.intervalDays).toBe(7);
    expect(item.stageIndex).toBe(2);
  });

  it('interleaves sections from different chapters rather than grouping same-chapter sections consecutively', () => {
    const due = '2026-10-25T12:00:00.000Z';
    const queue = [
      buildOrUpdateRevisitItem({
        bookId: 'bolton-2005',
        sectionId: '4.1',
        chapterId: '4',
        sectionTitle: 'Two Performance Outcomes',
        gapCount: 2,
        unansweredPromptsCount: 0,
        nowIso: due,
      }),
      buildOrUpdateRevisitItem({
        bookId: 'bolton-2005',
        sectionId: '4.2',
        chapterId: '4',
        sectionTitle: 'Linear Contracts',
        gapCount: 2,
        unansweredPromptsCount: 0,
        nowIso: due,
      }),
      buildOrUpdateRevisitItem({
        bookId: 'bolton-2005',
        sectionId: '2.1',
        chapterId: '2',
        sectionTitle: 'The Simple Economics of Adverse Selection',
        gapCount: 2,
        unansweredPromptsCount: 0,
        nowIso: due,
      }),
    ];

    const interleaved = interleaveRevisitQueue(queue);
    expect(interleaved.map((i) => i.chapterId)).toEqual(['4', '2', '4']);
  });
});

describe('4. Section Pre-Questions & Ingestion Guarantees', () => {
  it('guarantees §1.1 has pre-questions and paragraphs in Bolton seed structure', () => {
    const sec11 = BOLTON_BOOK_STRUCTURE.sections.find((s) => s.id === '1.1');
    expect(sec11).toBeDefined();
    expect(sec11?.paragraphs.length).toBeGreaterThan(0);
    expect(BOLTON_1_1_PRE_QUESTIONS.length).toBeGreaterThanOrEqual(3);
    expect(BOLTON_1_1_PRE_QUESTIONS.every((pq) => pq.sectionId === '1.1')).toBe(true);
  });
});

describe('5. AI Client & Gemini API Key Management', () => {
  it('stores and retrieves Gemini API key and AI provider in localStorage', async () => {
    const { getStoredGeminiKey, setStoredGeminiKey, getStoredProvider, setStoredProvider } = await import('../src/lib/aiClient');
    setStoredGeminiKey('AIzaSyTestKey123456');
    expect(getStoredGeminiKey()).toBe('AIzaSyTestKey123456');

    setStoredProvider('gemini');
    expect(getStoredProvider()).toBe('gemini');

    setStoredProvider('anthropic');
    expect(getStoredProvider()).toBe('anthropic');

    setStoredGeminiKey('');
    expect(getStoredGeminiKey()).toBe('');
  });

  it('generates cached local instrument when no keys are configured', async () => {
    const { generateInstrument } = await import('../src/lib/aiClient');
    const resp = await generateInstrument({
      bookId: 'bolton-2005',
      sectionId: '4.2',
      method: 'free_recall_check',
      sectionExcerpt: 'Section excerpt content',
      provider: 'gemini',
    });
    expect(resp.status).toBe('cached_local');
    expect(resp.provider).toBe('gemini');
    expect(resp.model).toContain('gemini');
  });
});

describe('6. Desktop Application Packaging Configuration', () => {
  it('has valid Electron packaging and main entry point configuration', () => {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    expect(pkg.main).toBe('electron/main.cjs');
    expect(pkg.scripts['electron:dev']).toBeDefined();
    expect(pkg.scripts['electron:build']).toBeDefined();
    expect(pkg.scripts['electron:pack:mac']).toBeDefined();
    expect(pkg.scripts['electron:pack:win']).toBeDefined();
    expect(pkg.scripts['electron:pack:linux']).toBeDefined();

    expect(pkg.build).toBeDefined();
    expect(pkg.build.appId).toBe('com.madaralabs.margin');
    expect(pkg.build.mac.target).toContain('dmg');
    expect(pkg.build.win.target).toContain('nsis');
    expect(pkg.build.linux.target).toContain('AppImage');

    const mainFile = path.resolve(__dirname, '../electron/main.cjs');
    expect(fs.existsSync(mainFile)).toBe(true);

    const preloadFile = path.resolve(__dirname, '../electron/preload.cjs');
    expect(fs.existsSync(preloadFile)).toBe(true);
  });
});
