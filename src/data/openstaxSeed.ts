import { parseDocumentStructure } from '../lib/ingestionParser';
import { BookStructure, ExplorableLabSpec, PreQuestion, SectionKeyIdea } from '../types/margin';

export const OPENSTAX_RAW_MARKDOWN = `# OpenStax Principles of Economics 3e (CC-BY 4.0)
Contents
7 Cost and Industry Structure 165
7.1 Explicit and Implicit Costs, and Accounting and Economic Profit 166
8 Perfect Competition 189
8.2 How Perfectly Competitive Firms Make Output Decisions 192
8.3 Entry and Exit Decisions in the Long Run 201

=== PAGE 166 ===
7 Cost and Industry Structure

7.1 Explicit and Implicit Costs, and Accounting and Economic Profit

Every firm strives to earn a profit, which is the difference between total revenue and total cost:

$$\\Pi = TR - TC$$ (7.1)

Accounting profit is total revenue minus explicit monetary costs. Economic profit subtracts both explicit and implicit opportunity costs:

$$\\Pi_{\\text{econ}} = P \\cdot Q - C_{\\text{explicit}} - C_{\\text{implicit}}$$ (7.2)

=== PAGE 192 ===
8 Perfect Competition

8.2 How Perfectly Competitive Firms Make Output Decisions

A perfectly competitive firm is a price taker facing market price $P$ and short-run quadratic cost $TC(q) = F + c_1 q + \\frac{1}{2} c_2 q^2$:

$$TC(q) = F + c_1 q + \\frac{1}{2} c_2 q^2$$ (8.1)

The firm maximizes profit $\\Pi(q) = P q - TC(q)$:

$$\\max_{q \\ge 0} \\Pi(q) = P \\cdot q - \\left(F + c_1 q + \\frac{1}{2} c_2 q^2\\right)$$ (8.2)

Taking the first-order condition equates price $P$ with marginal cost $MC(q) = c_1 + c_2 q$:

$$P = c_1 + c_2 q \\implies q^* = \\frac{P - c_1}{c_2}$$ (8.3)

Worked Example 8.1: Output and Profit at a Competitive Raspberry Farm
Suppose market price is P = 4, fixed cost is F = 2, linear unit cost is c_1 = 0, and marginal cost slope is c_2 = 1. Then optimal output is q^* = 4.0, total revenue is TR = 16.0, total cost is TC = 10.0, and maximum profit is Pi^* = 6.0.

| Quantity (q) | Total Revenue (TR) | Fixed Cost (F) | Variable Cost (VC) | Total Cost (TC) | Marginal Cost (MC) | Profit (Pi) |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 0.0 | 2.0 | 0.0 | 2.0 | 0.0 | -2.0 |
| 1 | 4.0 | 2.0 | 0.5 | 2.5 | 1.0 | 1.5 |
| 2 | 8.0 | 2.0 | 2.0 | 4.0 | 2.0 | 4.0 |
| 3 | 12.0 | 2.0 | 4.5 | 6.5 | 3.0 | 5.5 |
| 4 | 16.0 | 2.0 | 8.0 | 10.0 | 4.0 | 6.0 |
| 5 | 20.0 | 2.0 | 12.5 | 14.5 | 5.0 | 5.5 |

=== PAGE 201 ===
8.3 Entry and Exit Decisions in the Long Run

In the long run, free entry and exit drive economic profit to zero at minimum average total cost:

$$P_{LR} = \\min_{q > 0} AC(q) = c_1 + \\sqrt{2 F c_2}$$ (8.4)
`;

export const OPENSTAX_BOOK_STRUCTURE: BookStructure = parseDocumentStructure(
  OPENSTAX_RAW_MARKDOWN,
  {
    bookId: 'openstax-econ-3e',
    title: 'Principles of Economics 3e (CC-BY 4.0)',
    authors: 'OpenStax / Rice University',
    license: 'CC-BY 4.0',
    totalPages: 210,
  }
);

export const OPENSTAX_8_2_PRE_QUESTIONS: PreQuestion[] = [
  {
    id: 'pq-8.2-1',
    sectionId: '8.2',
    question:
      'Before reading §8.2: Why does an increase in fixed cost F not change a competitive firm’s short-run profit-maximizing output q*?',
    targetParagraphId: 'p-8.2-6',
    anchor: {
      bookId: 'openstax-econ-3e',
      sectionId: '8.2',
      page: 192,
      paragraphId: 'p-8.2-6',
      excerptShort: 'p. 192 — FOC P = MC(q) => q* = (P - c1)/c2',
    },
  },
];

export const OPENSTAX_8_2_KEY_IDEAS: SectionKeyIdea[] = [
  {
    id: 'ki-8.2-1',
    sectionId: '8.2',
    idea: 'Price-taking firm equates marginal revenue P with marginal cost MC(q) = c1 + c2*q, yielding q* = (P - c1)/c2.',
    keywords: ['price', 'marginal cost', 'mc', 'c2', 'first-order'],
    anchor: { bookId: 'openstax-econ-3e', sectionId: '8.2', page: 192, paragraphId: 'p-8.2-6' },
  },
];

export const OPENSTAX_8_2_LAB_SPEC: ExplorableLabSpec = {
  id: 'lab-openstax-8-2',
  sectionId: '8.2',
  title: 'Competitive Firm Output & Marginal Cost Lab (OpenStax §8.2)',
  subtitle: 'TC(q) = F + c₁q + ½c₂q², P = MC(q)',
  anchor: { bookId: 'openstax-econ-3e', sectionId: '8.2', page: 192, paragraphId: 'p-8.2-6' },
  parameters: [
    { name: 'P', symbol: 'P', label: 'Market Price (P)', min: 1, max: 10, step: 0.5, defaultValue: 4 },
    { name: 'F', symbol: 'F', label: 'Fixed Cost (F)', min: 0, max: 10, step: 0.5, defaultValue: 2 },
    { name: 'c1', symbol: 'c₁', label: 'Base Marginal Cost (c₁)', min: 0, max: 4, step: 0.5, defaultValue: 0 },
    { name: 'c2', symbol: 'c₂', label: 'MC Slope (c₂)', min: 0.5, max: 4, step: 0.25, defaultValue: 1 },
  ],
  formulas: [
    {
      name: 'q_star',
      symbol: 'q*',
      label: 'Optimal Output (q*)',
      expression: 'max(0, (P - c1) / c2)',
      latex: 'q^* = \\frac{P - c_1}{c_2}',
    },
    {
      name: 'tr_star',
      symbol: 'TR*',
      label: 'Total Revenue (TR)',
      expression: 'P * q_star',
    },
    {
      name: 'tc_star',
      symbol: 'TC*',
      label: 'Total Cost (TC)',
      expression: 'F + c1 * q_star + 0.5 * c2 * (q_star^2)',
    },
    {
      name: 'pi_sb',
      symbol: 'Π*',
      label: 'Maximum Economic Profit (Π*)',
      expression: 'tr_star - tc_star',
      latex: '\\Pi^* = P q^* - TC(q^*)',
    },
  ],
  chart: {
    xVariable: 'q',
    xLabel: 'Output Quantity (q)',
    xMin: 0,
    xMax: 6,
    yLabel: 'Dollars ($)',
    series: [
      {
        key: 'profit_curve',
        label: 'Profit Π(q)',
        expression: 'P * q - (F + c1 * q + 0.5 * c2 * q^2)',
        color: '#2563eb',
      },
      {
        key: 'mc_curve',
        label: 'Marginal Cost MC(q)',
        expression: 'c1 + c2 * q',
        color: '#dc2626',
        dashed: true,
      },
    ],
  },
  workedExamples: [
    {
      id: 'ex-openstax-8-1',
      title: 'Worked Example 8.1 (P=4, F=2, c₁=0, c₂=1)',
      anchor: { bookId: 'openstax-econ-3e', sectionId: '8.2', page: 192 },
      inputs: { P: 4, F: 2, c1: 0, c2: 1 },
      expected: { q_star: 4.0, tr_star: 16.0, tc_star: 10.0, pi_sb: 6.0 },
    },
  ],
  assumptions: [{ name: 'convex_cost', expression: 'c2 > 0', description: 'Convex variable cost c₂ > 0' }],
  scopeNote: 'Short-run competitive firm output decision (OpenStax Ch. 8, CC-BY 4.0).',
};
