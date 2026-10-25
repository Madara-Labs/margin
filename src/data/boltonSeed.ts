// ============================================================================
// Structured Index & Study Instruments for:
// 1. Bolton & Dewatripont (2005), Contract Theory — Chapter 4 (especially §4.2)
//    Note: Contains structured equation anchors, mathematical formulations, and
//    study instruments (pre-questions, key-idea anchors, reference concept map,
//    verified explorable lab). When the user's local PDF is present on disk,
//    PDF.js renders the exact PDF pages alongside these anchored instruments.
// 2. OpenStax Principles of Economics 3e (CC-BY 4.0) — Chapter 8
// ============================================================================

import {
  BookStructure,
  ConceptMapSpec,
  ExplorableLabSpec,
  PreQuestion,
  PromptLogEntry,
  RevisitQueueItem,
  SectionKeyIdea,
  SelfExplanationPrompt,
} from '../types/margin';

export const BOLTON_BOOK_STRUCTURE: BookStructure = {
  bookId: 'bolton-2005',
  title: 'Contract Theory',
  authors: 'Patrick Bolton & Mathias Dewatripont (MIT Press, 2005)',
  totalPages: 737,
  pdfAvailable: true,
  pdfFilename: 'BOLTON 2005 , Contract Theory - Unknown.pdf',
  toc: [
    { id: 'toc-1', number: '1', title: 'Introduction', level: 1, page: 1, pdfPage: 18 },
    { id: 'toc-1.1', number: '1.1', title: 'Optimal Employment Contracts without Uncertainty, Hidden Information, or Hidden Actions', level: 2, page: 4, pdfPage: 21 },
    { id: 'toc-2', number: '2', title: 'Hidden Information, Screening', level: 1, page: 47, pdfPage: 62 },
    { id: 'toc-2.1', number: '2.1', title: 'The Simple Economics of Adverse Selection', level: 2, page: 47, pdfPage: 62 },
    { id: 'toc-3', number: '3', title: 'Hidden Information, Signaling', level: 1, page: 99, pdfPage: 114 },
    { id: 'toc-4', number: '4', title: 'Hidden Action, Moral Hazard', level: 1, page: 129, pdfPage: 144 },
    { id: 'toc-4.1', number: '4.1', title: 'Two Performance Outcomes', level: 2, page: 130, pdfPage: 145 },
    { id: 'toc-4.1.1', number: '4.1.1', title: 'First-Best versus Second-Best Contracts', level: 3, page: 130, pdfPage: 145 },
    { id: 'toc-4.1.4', number: '4.1.4', title: 'Bilateral Risk Aversion & Borch Rule', level: 3, page: 135, pdfPage: 150 },
    { id: 'toc-4.1.5', number: '4.1.5', title: 'The Value of Information (Sufficient Statistic)', level: 3, page: 136, pdfPage: 151 },
    {
      id: 'toc-4.2',
      number: '4.2',
      title: 'Linear Contracts, Normally Distributed Performance, and Exponential Utility',
      level: 2,
      page: 137,
      pdfPage: 152,
    },
    { id: 'toc-4.3', number: '4.3', title: 'The Suboptimality of Linear Contracts in the Classical Model', level: 2, page: 139, pdfPage: 154 },
    { id: 'toc-4.4', number: '4.4', title: 'General Case: The First-Order Approach (MLRP & CDFC)', level: 2, page: 142, pdfPage: 157 },
    { id: 'toc-4.5', number: '4.5', title: 'Grossman and Hart’s Two-Stage Approach', level: 2, page: 152, pdfPage: 167 },
    { id: 'toc-4.6', number: '4.6', title: 'Applications: Managerial Incentives & Debt', level: 2, page: 157, pdfPage: 172 },
    { id: 'toc-6', number: '6', title: 'Multidimensional Incentive Problems (Multitasking)', level: 1, page: 199, pdfPage: 214 },
    { id: 'toc-8', number: '8', title: 'Multiagent Moral Hazard and Collusion', level: 1, page: 297, pdfPage: 312 },
    { id: 'toc-10', number: '10', title: 'Dynamic Moral Hazard', level: 1, page: 419, pdfPage: 434 },
  ],
  sections: [
    {
      id: '1.1',
      chapterId: '1',
      number: '1.1',
      title: 'Optimal Employment Contracts without Uncertainty, Hidden Information, or Hidden Actions',
      startPage: 4,
      endPage: 7,
      pdfStartPage: 21,
      pdfEndPage: 24,
      paragraphs: [
        {
          id: 'p-1.1-1',
          sectionId: '1.1',
          page: 4,
          index: 1,
          kind: 'prose',
          text: "Consider the following standard bilateral contracting problem between an employer and employee: the employee has an initial endowment of time, which she can keep for herself of sell to the employer as labor services, because the employer can make productive use of the employee's time. Specifically, we can assume therefore that the parties' utility functions depend both on the allocation of employee time and on their purchasing power. Let us denote the employer's utility function as U(l, t) where l is the quantity of employee time the employer has acquired and t denotes the quantity of \"money\"—or equivalently the \"output\" that this money can buy—that he has at his disposal. Similarly, employee utility is u(l, t), where l is the quantity of time the employee has kept for herself and t is the quantity of money that she has at her disposal.",
        },
        {
          id: 'p-1.1-2',
          sectionId: '1.1',
          page: 5,
          index: 2,
          kind: 'prose',
          text: 'Both individuals are assumed to have convex preferences (so that indifference curves are strictly convex to the origin). In this bilateral monopoly setting, the two parties will want to negotiate an optimal contract determining the allocation of labor time and the transfer of monetary compensation. When both parties possess complete and symmetric information, any Pareto-optimal contract must equalize their marginal rates of substitution between time and purchasing power.',
        },
        {
          id: 'p-1.1-3',
          sectionId: '1.1',
          page: 6,
          index: 3,
          kind: 'equation',
          text: 'First-Best Efficiency Condition in the Edgeworth Box:',
          latex: "\\frac{U_l(l^*, t^*)}{U_t(l^*, t^*)} = \\frac{u_l(l^*, t^*)}{u_t(l^*, t^*)}",
          equationLabel: '(1.1)',
        },
        {
          id: 'p-1.1-4',
          sectionId: '1.1',
          page: 7,
          index: 4,
          kind: 'prose',
          text: 'Subject to the employee receiving at least her reservation utility u_0, the principal captures all remaining economic surplus. Because information is complete and actions are fully verifiable by a third-party court, there is no scope for opportunistic behavior, moral hazard, or adverse selection. This First-Best allocation constitutes the efficiency benchmark against which all subsequent contractual frictions are evaluated.',
        },
      ],
      equations: [
        {
          id: 'eq-1.1-1',
          sectionId: '1.1',
          page: 6,
          latex: "\\frac{U_l(l^*, t^*)}{U_t(l^*, t^*)} = \\frac{u_l(l^*, t^*)}{u_t(l^*, t^*)}",
          label: '(1.1)',
          description: 'Equality of marginal rates of substitution across principal and agent under complete information.',
        },
      ],
      tables: [],
      workedExamples: [],
    },
    {
      id: '4.1',
      chapterId: '4',
      number: '4.1',
      title: 'Two Performance Outcomes',
      startPage: 130,
      endPage: 136,
      pdfStartPage: 145,
      pdfEndPage: 151,
      paragraphs: [
        {
          id: 'p-4.1-1',
          sectionId: '4.1',
          page: 130,
          index: 1,
          kind: 'prose',
          text: 'In the two-outcome moral hazard model, output q ∈ {0, 1} ("failure" or "success") occurs with probability Pr(q = 1 | a) = p(a), strictly increasing and concave in effort a. The risk-neutral or risk-averse principal maximizes expected utility V(q − w) while the agent has separable utility u(w) − ψ(a).',
        },
        {
          id: 'p-4.1-2',
          sectionId: '4.1',
          page: 131,
          index: 2,
          kind: 'equation',
          text: 'First-Best Coinsurance (Borch Rule) vs. Second-Best Likelihood Ratio Distortion:',
          latex: "\\frac{V'(q_i - w_i)}{u'(w_i)} = \\lambda + \\mu \\frac{p_i'(a)}{p_i(a)}",
          equationLabel: '(4.1)',
        },
        {
          id: 'p-4.1-3',
          sectionId: '4.1',
          page: 136,
          index: 3,
          kind: 'derivation',
          text: 'Sufficient Statistic Result (Holmström, 1979): An additional signal s ∈ {0, 1} drops out of the optimal incentive contract if and only if q is a sufficient statistic for (q, s) with respect to effort a—meaning the likelihood ratio ∂log P(q,s|a)/∂a does not depend on s. When s is informative about effort noise, conditioning wages on s improves the risk-incentive trade-off.',
        },
      ],
      equations: [
        {
          id: 'eq-4.1-1',
          sectionId: '4.1',
          page: 131,
          latex: "\\frac{V'(q_i - w_i)}{u'(w_i)} = \\lambda + \\mu \\frac{p_i'(a)}{p_i(a)}",
          label: '(4.1)',
          description: 'Optimal risk sharing distorted by the likelihood ratio when effort is hidden (μ > 0).',
        },
      ],
      tables: [],
      workedExamples: [],
    },
    {
      id: '4.2',
      chapterId: '4',
      number: '4.2',
      title: 'Linear Contracts, Normally Distributed Performance, and Exponential Utility',
      startPage: 137,
      endPage: 139,
      pdfStartPage: 152,
      pdfEndPage: 154,
      paragraphs: [
        {
          id: 'p-4.2-1',
          sectionId: '4.2',
          page: 137,
          index: 1,
          kind: 'prose',
          text: 'Next to the two-performance-outcome case, another widely used special case involves linear contracts, normally distributed performance, and exponential (CARA) utility. Performance equals effort plus noise: q = a + ε, where ε ~ N(0, σ²). The principal is risk-neutral. The agent has constant absolute risk aversion (CARA) preferences with coefficient η = −u″/u′ > 0, and effort cost ψ(a) = ½ c a² is measured in monetary units.',
        },
        {
          id: 'p-4.2-2',
          sectionId: '4.2',
          page: 137,
          index: 2,
          kind: 'equation',
          text: 'Agent CARA Utility and Linear Compensation Contract:',
          latex: 'u(w, a) = -e^{-\\eta [w - \\psi(a)]}, \\quad \\psi(a) = \\frac{1}{2} c a^2, \\quad w = t + s q',
          equationLabel: '(4.2a)',
        },
        {
          id: 'p-4.2-3',
          sectionId: '4.2',
          page: 138,
          index: 3,
          kind: 'prose',
          text: 'Here t is the fixed salary component and s is the variable performance share (piece rate). The risk-neutral principal chooses (a, t, s) to maximize expected profit E[q − w] subject to the agent’s Individual Rationality (IR) constraint E[u(w, a)] ≥ u(w̄) and Incentive Compatibility (IC) constraint.',
        },
        {
          id: 'p-4.2-4',
          sectionId: '4.2',
          page: 138,
          index: 4,
          kind: 'derivation',
          text: 'Derivation of Certainty Equivalent Wealth: Because ε ~ N(0, σ²), the moment-generating function of a normal random variable gives E[exp(−η s ε)] = exp(½ η² s² σ²). Maximizing expected exponential utility E[−exp(−η(t + s(a + ε) − ½ c a²))] is therefore monotonically equivalent to maximizing the agent’s certainty equivalent wealth ŵ(a):',
        },
        {
          id: 'p-4.2-5',
          sectionId: '4.2',
          page: 139,
          index: 5,
          kind: 'equation',
          text: 'Agent Certainty Equivalent (Expected Wage − Effort Cost − Risk Premium):',
          latex: '\\hat{w}(a) = t + s a - \\frac{1}{2} c a^2 - \\frac{1}{2} \\eta s^2 \\sigma^2 \\ge \\bar{w}',
          equationLabel: '(CE)',
        },
        {
          id: 'p-4.2-6',
          sectionId: '4.2',
          page: 139,
          index: 6,
          kind: 'derivation',
          text: 'Agent Incentive Compatibility (IC): For any piece rate s offered by the principal, the agent chooses effort a to maximize certainty equivalent wealth ŵ(a). Notice that the fixed transfer t and the variance risk premium ½ η s² σ² do not depend on a. Taking the first-order condition ∂ŵ/∂a = s − c a = 0 yields the unique global optimum:',
        },
        {
          id: 'p-4.2-7',
          sectionId: '4.2',
          page: 139,
          index: 7,
          kind: 'equation',
          text: 'Agent Best-Response Effort (IC Constraint):',
          latex: 'a^*(s) = \\frac{s}{c}',
          equationLabel: '(IC)',
        },
        {
          id: 'p-4.2-8',
          sectionId: '4.2',
          page: 139,
          index: 8,
          kind: 'derivation',
          text: 'Principal Optimization and Optimal Piece Rate s*: Knowing that the agent sets a = s/c and that the participation constraint (IR) binds with equality (t = w̄ − s²/c + ½ s²/c + ½ η s² σ²), the principal substitutes t and a = s/c into expected profit Π = E[q − w] = a − t − s a to maximize total certainty-equivalent surplus:',
        },
        {
          id: 'p-4.2-9',
          sectionId: '4.2',
          page: 139,
          index: 9,
          kind: 'equation',
          text: 'Second-Best Optimal Linear Piece Rate and Principal Profit:',
          latex: 's^* = \\frac{1}{1 + \\eta c \\sigma^2}, \\quad a^* = \\frac{1}{c(1 + \\eta c \\sigma^2)}, \\quad \\Pi^{SB} = \\frac{1}{2c(1 + \\eta c \\sigma^2)} - \\bar{w}',
          equationLabel: '(4.2*)',
        },
        {
          id: 'p-4.2-10',
          sectionId: '4.2',
          page: 139,
          index: 10,
          kind: 'example',
          text: 'Worked Example 4.2 (Benchmark Parameterization): For effort cost c = 1, CARA risk aversion η = 2, output noise std dev σ = 0.5 (so σ² = 0.25), and reservation wage w̄ = 0: under First-Best (observable effort), the principal sets s_FB = 0 (full insurance), requires efficient effort a_FB = 1/c = 1.0, pays flat wage t_FB = 0.5, and earns First-Best profit Π_FB = 1/(2c) = 0.50. Under Second-Best (hidden effort), the optimal slope is s* = 1 / (1 + 2 × 1 × 0.25) = 2/3 ≈ 0.6667, induced effort is a* = 2/3, and Second-Best profit is Π_SB = 1 / (2 × 1 × 1.5) = 1/3 ≈ 0.3333. The agency cost of moral hazard is Π_FB − Π_SB = 1/6 ≈ 0.1667.',
        },
        {
          id: 'p-4.2-11',
          sectionId: '4.2',
          page: 139,
          index: 11,
          kind: 'table',
          text: 'Table 4.2: Comparative Statics & Benchmark Regimes in the Linear-CARA Model (c=1, η=2, σ=0.5, w̄=0)',
          tableData: {
            id: 'tbl-4.2-1',
            sectionId: '4.2',
            page: 139,
            caption: 'Table 4.2: First-Best, Second-Best, and Comparative Statics Regimes (§4.2)',
            headers: ['Regime / Case', 'c', 'η', 'σ', 'Piece Rate s*', 'Effort a*', 'Risk Premium', 'Principal Profit Π'],
            rows: [
              ['First-Best (Observable a)', 1.0, 2.0, 0.5, 0.0, 1.0, 0.0, 0.5],
              ['Second-Best Benchmark', 1.0, 2.0, 0.5, 0.6667, 0.6667, 0.1111, 0.3333],
              ['Low Noise (σ = 0.25)', 1.0, 2.0, 0.25, 0.8889, 0.8889, 0.0494, 0.4444],
              ['High Risk Aversion (η = 4)', 1.0, 4.0, 0.5, 0.5, 0.5, 0.125, 0.25],
              ['High Effort Cost (c = 2)', 2.0, 2.0, 0.5, 0.5, 0.25, 0.0625, 0.125],
              ['Naive Flat Wage (s = 0)', 1.0, 2.0, 0.5, 0.0, 0.0, 0.0, 0.0],
            ],
          },
        },
      ],
      equations: [
        {
          id: 'eq-4.2-1',
          sectionId: '4.2',
          page: 137,
          latex: 'u(w, a) = -e^{-\\eta [w - \\frac{1}{2}c a^2]}, \\quad w = t + s q',
          label: '(4.2a)',
          description: 'Agent CARA negative exponential utility and linear compensation rule.',
        },
        {
          id: 'eq-4.2-2',
          sectionId: '4.2',
          page: 139,
          latex: '\\hat{w}(a) = t + s a - \\frac{1}{2} c a^2 - \\frac{1}{2} \\eta s^2 \\sigma^2',
          label: '(CE)',
          description: 'Closed-form certainty equivalent compensation under normal noise.',
        },
        {
          id: 'eq-4.2-3',
          sectionId: '4.2',
          page: 139,
          latex: 'a^*(s) = \\frac{s}{c}',
          label: '(IC)',
          description: 'Agent incentive compatibility best-response effort.',
        },
        {
          id: 'eq-4.2-4',
          sectionId: '4.2',
          page: 139,
          latex: 's^* = \\frac{1}{1 + \\eta c \\sigma^2}, \\quad \\Pi^{SB} = \\frac{1}{2c(1 + \\eta c \\sigma^2)} - \\bar{w}',
          label: '(4.2*)',
          description: 'Second-best optimal linear piece rate and expected principal profit.',
        },
      ],
      tables: [
        {
          id: 'tbl-4.2-1',
          sectionId: '4.2',
          page: 139,
          caption: 'Table 4.2: First-Best, Second-Best, and Comparative Statics Regimes (§4.2)',
          headers: ['Regime / Case', 'c', 'η', 'σ', 'Piece Rate s*', 'Effort a*', 'Risk Premium', 'Principal Profit Π'],
          rows: [
            ['First-Best (Observable a)', 1.0, 2.0, 0.5, 0.0, 1.0, 0.0, 0.5],
            ['Second-Best Benchmark', 1.0, 2.0, 0.5, 0.6667, 0.6667, 0.1111, 0.3333],
            ['Low Noise (σ = 0.25)', 1.0, 2.0, 0.25, 0.8889, 0.8889, 0.0494, 0.4444],
            ['High Risk Aversion (η = 4)', 1.0, 4.0, 0.5, 0.5, 0.5, 0.125, 0.25],
            ['High Effort Cost (c = 2)', 2.0, 2.0, 0.5, 0.5, 0.25, 0.0625, 0.125],
            ['Naive Flat Wage (s = 0)', 1.0, 2.0, 0.5, 0.0, 0.0, 0.0, 0.0],
          ],
        },
      ],
      workedExamples: [
        {
          id: 'ex-bolton-4-2-benchmark',
          sectionId: '4.2',
          page: 139,
          title: 'Bolton §4.2 Linear-CARA Moral Hazard Benchmark (c=1, η=2, σ=0.5)',
          parameters: { c: 1.0, eta: 2.0, sigma: 0.5, wbar: 0.0 },
          expectedOutputs: { s_star: 2 / 3, a_star: 2 / 3, pi_sb: 1 / 3, pi_fb: 0.5 },
          notes: 'Matches analytical benchmark: s* = 2/3, Π_SB = 1/3, Π_FB = 0.5.',
        },
      ],
    },
    {
      id: '4.3',
      chapterId: '4',
      number: '4.3',
      title: 'The Suboptimality of Linear Contracts in the Classical Model',
      startPage: 139,
      endPage: 142,
      pdfStartPage: 154,
      pdfEndPage: 157,
      paragraphs: [
        {
          id: 'p-4.3-1',
          sectionId: '4.3',
          page: 140,
          index: 1,
          kind: 'prose',
          text: 'Mirrlees (1975) showed that even when noise ε ~ N(0, σ²) has unbounded support, the likelihood ratio f_a(q|a)/f(q|a) = (q − a)/σ² becomes arbitrarily negative in the extreme left tail (q → −∞). A step-function contract paying fixed wage w* + δ above a low threshold q̄ and a severe punishment K below q̄ approximates the First-Best arbitrarily closely in the static model.',
        },
        {
          id: 'p-4.3-2',
          sectionId: '4.3',
          page: 142,
          index: 2,
          kind: 'prose',
          text: 'Holmström and Milgrom (1987) rescue the linear contract by moving to continuous-time Brownian motion where the agent observes cumulative performance and adjusts effort dynamically; preventing gaming of nonlinear thresholds makes linear contracts globally optimal.',
        },
      ],
      equations: [
        {
          id: 'eq-4.3-1',
          sectionId: '4.3',
          page: 140,
          latex: '\\frac{f_a(q \\mid a)}{f(q \\mid a)} = \\frac{q - a}{\\sigma^2}',
          label: '(LR)',
          description: 'Normal likelihood ratio is linear in q and unbounded in the tails.',
        },
      ],
      tables: [],
      workedExamples: [],
    },
  ],
};

// ============================================================================
// Method 1: Pre-Questions for Bolton §1.1 & §4.2 (Pretesting Effect)
// ============================================================================

export const BOLTON_1_1_PRE_QUESTIONS: PreQuestion[] = [
  {
    id: 'pq-1.1-1',
    sectionId: '1.1',
    question:
      'Before reading §1.1: When there is zero uncertainty and no hidden actions, what condition should equate the employer and employee marginal rates of substitution?',
    targetParagraphId: 'p-1.1-1',
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '1.1',
      page: 4,
      pdfPage: 21,
      paragraphId: 'p-1.1-1',
      excerptShort: 'p. 4 — Bilateral contracting problem between employer and employee',
    },
  },
  {
    id: 'pq-1.1-2',
    sectionId: '1.1',
    question:
      'How does the presence of an outside reservation utility constraint affect the allocation of economic surplus between principal and agent?',
    targetParagraphId: 'p-1.1-2',
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '1.1',
      page: 5,
      pdfPage: 22,
      paragraphId: 'p-1.1-2',
      excerptShort: 'p. 5 — Participation constraint and Pareto frontier',
    },
  },
  {
    id: 'pq-1.1-3',
    sectionId: '1.1',
    question:
      'Why does the full-information benchmark serve as the First-Best upper bound for all subsequent chapters on asymmetric information?',
    targetParagraphId: 'p-1.1-4',
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '1.1',
      page: 7,
      pdfPage: 24,
      paragraphId: 'p-1.1-4',
      excerptShort: 'p. 7 — First-Best efficiency comparison',
    },
  },
];

export const BOLTON_4_2_PRE_QUESTIONS: PreQuestion[] = [
  {
    id: 'pq-4.2-1',
    sectionId: '4.2',
    question:
      'Before reading §4.2: Under CARA utility and normal output noise ε ~ N(0, σ²), how does the agent’s risk premium depend on the incentive slope s and noise σ?',
    targetParagraphId: 'p-4.2-5',
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '4.2',
      page: 139,
      pdfPage: 154,
      paragraphId: 'p-4.2-5',
      excerptShort: 'p. 139 — Certainty Equivalent & Risk Premium ½ η s² σ²',
    },
  },
  {
    id: 'pq-4.2-2',
    sectionId: '4.2',
    question:
      'Does increasing the fixed base salary t motivate a CARA agent to exert more effort a? Why or why not?',
    targetParagraphId: 'p-4.2-7',
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '4.2',
      page: 139,
      pdfPage: 154,
      paragraphId: 'p-4.2-7',
      excerptShort: 'p. 139 — Agent IC condition a* = s / c (no wealth effect)',
    },
  },
  {
    id: 'pq-4.2-3',
    sectionId: '4.2',
    question:
      'As output noise σ² or risk aversion η rises, what happens to the optimal piece rate s* = 1/(1 + η c σ²), and what fundamental trade-off drives this?',
    targetParagraphId: 'p-4.2-9',
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '4.2',
      page: 139,
      pdfPage: 154,
      paragraphId: 'p-4.2-9',
      excerptShort: 'p. 139 — Optimal Linear Piece Rate s* = 1 / (1 + η c σ²)',
    },
  },
];

// ============================================================================
// Method 2: Key Ideas for Bolton §1.1 & §4.2 Free Recall Comparison
// ============================================================================

export const BOLTON_1_1_KEY_IDEAS: SectionKeyIdea[] = [
  {
    id: 'ki-1.1-1',
    sectionId: '1.1',
    idea: 'Bilateral contracting between employer and employee: utility depends on employee time and purchasing power (output or money transfer).',
    keywords: ['bilateral', 'employer', 'employee', 'time', 'money', 'purchasing power'],
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '1.1',
      page: 4,
      pdfPage: 21,
      paragraphId: 'p-1.1-1',
      excerptShort: 'p. 4 — Bilateral contracting setup',
    },
  },
  {
    id: 'ki-1.1-2',
    sectionId: '1.1',
    idea: 'Pareto-optimal contracts equate marginal rates of substitution (MRS) between employer and employee across time and monetary compensation.',
    keywords: ['mrs', 'marginal rate of substitution', 'pareto', 'equalize', 'edgeworth'],
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '1.1',
      page: 5,
      pdfPage: 22,
      paragraphId: 'p-1.1-2',
      excerptShort: 'p. 5 — Equality of MRS efficiency condition',
    },
  },
  {
    id: 'ki-1.1-3',
    sectionId: '1.1',
    idea: 'Complete information and third-party verifiability eliminate moral hazard and adverse selection, achieving the First-Best frontier benchmark.',
    keywords: ['complete information', 'verifiable', 'first-best', 'benchmark', 'reservation utility'],
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '1.1',
      page: 7,
      pdfPage: 24,
      paragraphId: 'p-1.1-4',
      excerptShort: 'p. 7 — First-Best benchmark without contractual friction',
    },
  },
];

export const BOLTON_4_2_KEY_IDEAS: SectionKeyIdea[] = [
  {
    id: 'ki-4.2-1',
    sectionId: '4.2',
    idea: 'Linear contract w = t + s·q with noisy performance q = a + ε, ε ~ N(0, σ²), and quadratic effort cost ψ(a) = ½ c a² in monetary units.',
    keywords: ['linear', 't + s', 'noise', 'normal', 'quadratic', 'ca^2', 'effort'],
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '4.2',
      page: 137,
      pdfPage: 152,
      paragraphId: 'p-4.2-2',
      excerptShort: 'p. 137 — Model setup & linear contract w = t + sq',
    },
  },
  {
    id: 'ki-4.2-2',
    sectionId: '4.2',
    idea: 'Certainty Equivalent wealth ŵ(a) = t + s·a − ½ c a² − ½ η s² σ² separates expected pay, effort cost, and the variance risk premium ½ η s² σ².',
    keywords: ['certainty equivalent', 'risk premium', 'eta', 'sigma', 'variance', 's^2'],
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '4.2',
      page: 139,
      pdfPage: 154,
      paragraphId: 'p-4.2-5',
      excerptShort: 'p. 139 — Certainty Equivalent Eq. (CE)',
    },
  },
  {
    id: 'ki-4.2-3',
    sectionId: '4.2',
    idea: 'Incentive Compatibility (IC) gives a* = s/c: effort depends solely on the piece rate s and cost c, independent of fixed pay t or noise σ² (no wealth effect under CARA).',
    keywords: ['s/c', 's / c', 'incentive', 'fixed', 'wealth', 'ic'],
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '4.2',
      page: 139,
      pdfPage: 154,
      paragraphId: 'p-4.2-7',
      excerptShort: 'p. 139 — Agent IC condition a = s/c',
    },
  },
  {
    id: 'ki-4.2-4',
    sectionId: '4.2',
    idea: 'Second-best optimal piece rate s* = 1 / (1 + η c σ²) balances effort incentives against the risk premium charged by the risk-averse agent.',
    keywords: ['1 +', 'eta', 'optimal', 'trade-off', 'insurance', '2/3', 'piece rate', 's*'],
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '4.2',
      page: 139,
      pdfPage: 154,
      paragraphId: 'p-4.2-9',
      excerptShort: 'p. 139 — Second-best slope s* = 1/(1 + ηcσ²)',
    },
  },
  {
    id: 'ki-4.2-5',
    sectionId: '4.2',
    idea: 'Benchmark comparative statics: for c=1, η=2, σ=0.5, s* = 2/3 and Π_SB = 1/3 < Π_FB = 0.5; higher c, η, or σ² lowers both s* and equilibrium effort a*.',
    keywords: ['2/3', '1/3', '0.5', 'first-best', 'comparative', 'decreases', 'down'],
    anchor: {
      bookId: 'bolton-2005',
      sectionId: '4.2',
      page: 139,
      pdfPage: 154,
      paragraphId: 'p-4.2-10',
      excerptShort: 'p. 139 — Numeric benchmark & comparative statics',
    },
  },
];

// ============================================================================
// Method 3: Reference Concept Map for Chapter 4 (Every node anchored to page)
// ============================================================================

export const BOLTON_CH4_REFERENCE_MAP: ConceptMapSpec = {
  chapterId: '4',
  nodes: [
    {
      id: 'ref-n1',
      label: 'Hidden Effort (a) & Noise (ε ~ N(0, σ²))',
      x: 110,
      y: 80,
      category: 'primitive',
      anchor: { bookId: 'bolton-2005', sectionId: '4.2', page: 137, pdfPage: 152, paragraphId: 'p-4.2-1' },
    },
    {
      id: 'ref-n2',
      label: 'CARA Preferences & Effort Cost ψ(a) = ½ca²',
      x: 420,
      y: 80,
      category: 'primitive',
      anchor: { bookId: 'bolton-2005', sectionId: '4.2', page: 137, pdfPage: 152, paragraphId: 'p-4.2-2' },
    },
    {
      id: 'ref-n3',
      label: 'Linear Contract w = t + s·q',
      x: 265,
      y: 185,
      category: 'choice',
      anchor: { bookId: 'bolton-2005', sectionId: '4.2', page: 137, pdfPage: 152, paragraphId: 'p-4.2-2' },
    },
    {
      id: 'ref-n4',
      label: 'Certainty Equivalent ŵ(a) & Risk Premium ½ηs²σ²',
      x: 265,
      y: 295,
      category: 'outcome',
      anchor: { bookId: 'bolton-2005', sectionId: '4.2', page: 139, pdfPage: 154, paragraphId: 'p-4.2-5' },
    },
    {
      id: 'ref-n5',
      label: 'Agent IC Constraint: a* = s / c',
      x: 95,
      y: 405,
      category: 'constraint',
      anchor: { bookId: 'bolton-2005', sectionId: '4.2', page: 139, pdfPage: 154, paragraphId: 'p-4.2-7' },
    },
    {
      id: 'ref-n6',
      label: 'Binding IR Constraint: ŵ(a*) = w̄',
      x: 445,
      y: 405,
      category: 'constraint',
      anchor: { bookId: 'bolton-2005', sectionId: '4.2', page: 139, pdfPage: 154, paragraphId: 'p-4.2-8' },
    },
    {
      id: 'ref-n7',
      label: 'Second-Best Slope s* = 1 / (1 + ηcσ²)',
      x: 265,
      y: 515,
      category: 'outcome',
      anchor: { bookId: 'bolton-2005', sectionId: '4.2', page: 139, pdfPage: 154, paragraphId: 'p-4.2-9' },
    },
    {
      id: 'ref-n8',
      label: 'Holmström-Milgrom (1987) vs Mirrlees (1975) Tail Test',
      x: 560,
      y: 515,
      category: 'theorem',
      anchor: { bookId: 'bolton-2005', sectionId: '4.3', page: 140, pdfPage: 155, paragraphId: 'p-4.3-1' },
    },
  ],
  edges: [
    { id: 'ref-e1', source: 'ref-n1', target: 'ref-n3', label: 'observed output q = a + ε' },
    { id: 'ref-e2', source: 'ref-n2', target: 'ref-n4', label: 'MGF of normal noise' },
    { id: 'ref-e3', source: 'ref-n3', target: 'ref-n4', label: 'induces risk exposure s²σ²' },
    { id: 'ref-e4', source: 'ref-n4', target: 'ref-n5', label: 'FOC ∂ŵ/∂a = 0' },
    { id: 'ref-e5', source: 'ref-n4', target: 'ref-n6', label: 'pins down base transfer t*' },
    { id: 'ref-e6', source: 'ref-n5', target: 'ref-n7', label: 'incentive benefit vs risk cost' },
    { id: 'ref-e7', source: 'ref-n6', target: 'ref-n7', label: 'principal absorbs risk premium' },
    { id: 'ref-e8', source: 'ref-n7', target: 'ref-n8', label: 'optimal in continuous time' },
  ],
};

// ============================================================================
// Method 5: Explorable Model Spec for Bolton §4.2 (with Mandatory Verification)
// ============================================================================

export const BOLTON_4_2_LAB_SPEC: ExplorableLabSpec = {
  id: 'lab-bolton-4-2',
  sectionId: '4.2',
  title: 'Linear-CARA-Normal Moral Hazard Lab (Bolton §4.2)',
  subtitle: 'Interactive risk-incentive trade-off: w = t + s·q, q = a + ε, ψ(a) = ½ca²',
  anchor: {
    bookId: 'bolton-2005',
    sectionId: '4.2',
    page: 139,
    pdfPage: 154,
    paragraphId: 'p-4.2-9',
    excerptShort: 'Bolton & Dewatripont (2005), §4.2, pp. 137–139',
  },
  parameters: [
    {
      name: 'c',
      symbol: 'c',
      label: 'Effort cost coefficient (c)',
      min: 0.25,
      max: 4.0,
      step: 0.25,
      defaultValue: 1.0,
    },
    {
      name: 'eta',
      symbol: 'η',
      label: 'Agent CARA risk aversion (η)',
      min: 0.25,
      max: 6.0,
      step: 0.25,
      defaultValue: 2.0,
    },
    {
      name: 'sigma',
      symbol: 'σ',
      label: 'Output noise std dev (σ)',
      min: 0.1,
      max: 1.5,
      step: 0.05,
      defaultValue: 0.5,
    },
    {
      name: 'wbar',
      symbol: 'w̄',
      label: 'Reservation certainty equivalent (w̄)',
      min: 0.0,
      max: 0.5,
      step: 0.05,
      defaultValue: 0.0,
    },
  ],
  formulas: [
    {
      name: 's_star',
      symbol: 's*',
      label: 'Second-best piece rate (s*)',
      expression: '1 / (1 + eta * c * sigma^2)',
      latex: 's^* = \\frac{1}{1 + \\eta c \\sigma^2}',
      description: 'Optimal share of output given to the agent under hidden effort.',
    },
    {
      name: 'a_star',
      symbol: 'a*',
      label: 'Second-best effort (a*)',
      expression: 's_star / c',
      latex: 'a^* = \\frac{s^*}{c}',
      description: 'Agent best-response effort under s*.',
    },
    {
      name: 'pi_sb',
      symbol: 'Π_SB',
      label: 'Second-best principal profit (Π_SB)',
      expression: '1 / (2 * c * (1 + eta * c * sigma^2)) - wbar',
      latex: '\\Pi^{SB} = \\frac{1}{2c(1 + \\eta c \\sigma^2)} - \\bar{w}',
      description: 'Principal expected payoff under optimal linear contract.',
    },
    {
      name: 'pi_fb',
      symbol: 'Π_FB',
      label: 'First-best principal profit (Π_FB)',
      expression: '1 / (2 * c) - wbar',
      latex: '\\Pi^{FB} = \\frac{1}{2c} - \\bar{w}',
      description: 'Full-information benchmark profit (when effort is observable, s=0, a=1/c).',
    },
    {
      name: 'risk_premium',
      symbol: 'RP',
      label: 'Risk premium cost (½ η s*² σ²)',
      expression: '0.5 * eta * (s_star^2) * (sigma^2)',
      latex: 'RP = \\frac{1}{2} \\eta (s^*)^2 \\sigma^2',
      description: 'Deadweight compensation required for bearing output noise.',
    },
    {
      name: 't_star',
      symbol: 't*',
      label: 'Optimal fixed base transfer (t*)',
      expression: 'wbar - (s_star^2) / c + 0.5 * (s_star^2) / c + 0.5 * eta * (s_star^2) * (sigma^2)',
      latex: 't^* = \\bar{w} - \\frac{(s^*)^2}{2c} + \\frac{1}{2}\\eta (s^*)^2 \\sigma^2',
      description: 'Fixed transfer chosen so the agent’s IR constraint binds.',
    },
  ],
  chart: {
    xVariable: 's',
    xLabel: 'Contract Slope / Piece Rate (s)',
    xMin: 0,
    xMax: 1,
    yLabel: 'Expected Payoff / Surplus',
    series: [
      {
        key: 'pi_of_s',
        label: 'Second-Best Principal Profit Π(s)',
        expression: '(s / c) - 0.5 * (s^2 / c) - 0.5 * eta * (s^2) * (sigma^2) - wbar',
        color: '#2563eb',
      },
      {
        key: 'pi_fb_line',
        label: 'First-Best Benchmark Π_FB',
        expression: '1 / (2 * c) - wbar',
        color: '#16a34a',
        dashed: true,
      },
      {
        key: 'rp_of_s',
        label: 'Risk Premium ½ηs²σ²',
        expression: '0.5 * eta * (s^2) * (sigma^2)',
        color: '#dc2626',
        dashed: true,
      },
    ],
  },
  workedExamples: [
    {
      id: 'ex-bolton-4-2-benchmark',
      title: 'Bolton §4.2 Benchmark (c=1, η=2, σ=0.5, w̄=0)',
      anchor: { bookId: 'bolton-2005', sectionId: '4.2', page: 139, pdfPage: 154 },
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
    { name: 'risk_averse_agent', expression: 'eta > 0', description: 'CARA η > 0' },
    { name: 'positive_noise', expression: 'sigma > 0', description: 'Noise std dev σ > 0' },
  ],
  scopeNote:
    'Optimal within the class of linear contracts w = t + s·q. Globally optimal in continuous-time Brownian motion (Holmström & Milgrom, 1987); see §4.3 for Mirrlees (1975) tail step-contracts.',
};

// ============================================================================
// Method 4: Self-Explanation Prompts (Feedback questions first, never immediate answer)
// ============================================================================

export const BOLTON_4_2_SELF_EXPLANATIONS: SelfExplanationPrompt[] = [
  {
    id: 'se-4.2-1',
    sectionId: '4.2',
    paragraphId: 'p-4.2-4',
    anchor: { bookId: 'bolton-2005', sectionId: '4.2', page: 138, pdfPage: 153, paragraphId: 'p-4.2-4' },
    question:
      'Why does taking the expectation E[exp(−η s ε)] with ε ~ N(0, σ²) produce the term +½ η² s² σ² inside the exponent?',
    feedbackQuestions: [
      'Complete the square in the normal density integral ∫ exp(−ηsε) · exp(−ε²/(2σ²)) dε: what is the shifted mean?',
      'Notice how −η enters squared as (−ηs)² σ² / 2. Once we factor out −η to write exp(−η ŵ(a)), why does one power of η remain in the risk premium ½ η s² σ²?',
    ],
    revealAnswer:
      'The moment-generating function of ε ~ N(0, σ²) evaluated at γ = −ηs is E[e^{γε}] = exp(½ γ² σ²) = exp(½ η² s² σ²). Factoring out −η from the exponent yields ŵ(a) = t + sa − ½ca² − ½ηs²σ².',
  },
  {
    id: 'se-4.2-2',
    sectionId: '4.2',
    paragraphId: 'p-4.2-8',
    anchor: { bookId: 'bolton-2005', sectionId: '4.2', page: 139, pdfPage: 154, paragraphId: 'p-4.2-8' },
    question:
      'What would change in the principal’s problem if the agent had a limited liability floor t ≥ 0 in addition to CARA utility?',
    feedbackQuestions: [
      'In the unconstrained §4.2 model, how does the principal adjust t when s increases?',
      'If t* = w̄ − s²/(2c) + ½ηs²σ² wants to be negative (the agent "buys the firm"), what happens when t ≥ 0 binds?',
    ],
    revealAnswer:
      'When t ≥ 0 binds, the principal can no longer extract the full certainty-equivalent surplus upfront via a negative base transfer t; the IR constraint stops binding and the agent earns positive limited-liability rent.',
  },
];

// ============================================================================
// Initial Spaced Revisit Queue & Initial Prompt Transparency Log
// ============================================================================

export const INITIAL_REVISIT_QUEUE: RevisitQueueItem[] = [
  {
    id: 'rev-bolton-4.2',
    bookId: 'bolton-2005',
    sectionId: '4.2',
    chapterId: '4',
    sectionTitle: 'Linear Contracts, Normally Distributed Performance, and Exponential Utility',
    gapCount: 2,
    unansweredPromptsCount: 1,
    recommendedMode: 'free_recall',
    intervalDays: 1,
    stageIndex: 0,
    lastAttemptAt: '2026-10-23T10:00:00.000Z',
    dueAt: '2026-10-24T10:00:00.000Z',
    completedCount: 1,
  },
  {
    id: 'rev-bolton-2.1',
    bookId: 'bolton-2005',
    sectionId: '2.1',
    chapterId: '2',
    sectionTitle: 'The Simple Economics of Adverse Selection (Mussa-Rosen Screening)',
    gapCount: 1,
    unansweredPromptsCount: 0,
    recommendedMode: 'retrieval_map',
    intervalDays: 3,
    stageIndex: 1,
    lastAttemptAt: '2026-10-21T10:00:00.000Z',
    dueAt: '2026-10-24T10:00:00.000Z',
    completedCount: 2,
  },
  {
    id: 'rev-bolton-4.1',
    bookId: 'bolton-2005',
    sectionId: '4.1',
    chapterId: '4',
    sectionTitle: 'Two Performance Outcomes & Sufficient Statistic Theorem',
    gapCount: 1,
    unansweredPromptsCount: 1,
    recommendedMode: 'free_recall',
    intervalDays: 7,
    stageIndex: 2,
    lastAttemptAt: '2026-10-18T10:00:00.000Z',
    dueAt: '2026-10-25T10:00:00.000Z',
    completedCount: 3,
  },
];

export const INITIAL_PROMPT_LOGS: PromptLogEntry[] = [
  {
    id: 'plog-init-1',
    timestamp: '2026-10-24T13:00:00.000Z',
    method: 'pre_questions',
    sectionId: '4.2',
    model: 'claude-sonnet-4-20250514',
    systemPrompt:
      'Generate 3 pre-questions for the upcoming textbook section. Never give away the formulas; ask predictive conceptual questions anchored to paragraph locations so the reader commits a guess before reading.',
    userPrompt:
      'Book: Bolton & Dewatripont (2005) | Section 4.2 (pp. 137–139): Linear Contracts, Normally Distributed Performance, and Exponential Utility [Excerpt: 3,140 chars]',
    sectionExcerptCharCount: 3140,
    status: 'cached_local',
    responseSummary: 'Produced 3 pre-questions anchored to p.139 (CE, IC, and s* comparative statics).',
  },
  {
    id: 'plog-init-2',
    timestamp: '2026-10-24T13:00:05.000Z',
    method: 'explorable_lab',
    sectionId: '4.2',
    model: 'claude-sonnet-4-20250514',
    systemPrompt:
      'Extract a typed ExplorableLabSpec (parameters, safe math.js formulas, chart definition, and worked numeric examples to verify against). Do not emit arbitrary JS code.',
    userPrompt:
      'Book: Bolton & Dewatripont (2005) | Section 4.2 (pp. 137–139) [Excerpt: 3,140 chars]. Verify against benchmark c=1, η=2, σ=0.5 => s*=2/3, Π_SB=1/3, Π_FB=0.5.',
    sectionExcerptCharCount: 3140,
    status: 'cached_local',
    responseSummary: 'Generated spec lab-bolton-4-2; automatic certificate verification PASSED (max error 0.00e+0).',
  },
];
