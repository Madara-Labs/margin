// ============================================================================
// Safe Expression Evaluator & Mandatory Verification Engine for Explorable Labs
// Uses math.js (never eval) and produces an explicit Certificate.
// Reference pattern: Certificate in ct_sim/theory/models/mh_linear_cara.py
// Rule: A generated lab must reproduce every worked numeric example in that
// section of the book. Run the check automatically. If it fails, do not show
// the lab: show "couldn't verify this model" with the reason.
// ============================================================================

import { create, all } from 'mathjs';
import {
  ExampleCheckDetail,
  ExplorableLabSpec,
  LabCertificate,
} from '../types/margin';

const math = create(all, {});

export interface EvaluatedLabState {
  parameters: Record<string, number>;
  outputs: Record<string, number>;
}

/**
 * Evaluates all formulas in a LabSpec sequentially (allowing later formulas
 * to reference earlier formula outputs, e.g. a_star referencing s_star) using
 * math.js's safe expression evaluator.
 */
export function evaluateLabFormulas(
  spec: ExplorableLabSpec,
  paramValues: Record<string, number>
): Record<string, number> {
  // Always seed the scope with every parameter's defaultValue first so
  // switching between books/labs never leaves an undefined symbol in math.js
  const defaults: Record<string, number> = {};
  for (const p of spec.parameters) {
    defaults[p.name] = p.defaultValue;
  }
  const scope: Record<string, number> = { ...defaults, ...paramValues };
  const outputs: Record<string, number> = {};

  for (const formula of spec.formulas) {
    const rawVal = math.evaluate(formula.expression, scope);
    const numVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);
    if (!Number.isFinite(numVal)) {
      throw new Error(
        `Formula "${formula.name}" (${formula.expression}) evaluated to non-finite value: ${String(rawVal)}`
      );
    }
    scope[formula.name] = numVal;
    outputs[formula.name] = numVal;
  }

  return outputs;
}

/**
 * Evaluates a chart series across X grid points safely using math.js.
 */
export function evaluateChartSeries(
  spec: ExplorableLabSpec,
  paramValues: Record<string, number>,
  numPoints = 65
): { xValues: number[]; seriesData: Record<string, number[]> } {
  const { xVariable, xMin, xMax, series } = spec.chart;
  const xValues: number[] = [];
  const step = (xMax - xMin) / Math.max(1, numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    xValues.push(Number((xMin + i * step).toFixed(4)));
  }

  let baseOutputs: Record<string, number> = {};
  try {
    baseOutputs = evaluateLabFormulas(spec, paramValues);
  } catch {
    baseOutputs = {};
  }
  const seriesData: Record<string, number[]> = {};
  for (const s of series) {
    seriesData[s.key] = [];
  }

  for (const xVal of xValues) {
    const localParams = { ...paramValues, [xVariable]: xVal };
    let localOutputs: Record<string, number> = {};
    try {
      localOutputs = evaluateLabFormulas(spec, localParams);
    } catch {
      localOutputs = {};
    }
    const scope = { ...baseOutputs, ...localParams, ...localOutputs };
    for (const s of series) {
      try {
        const val = Number(math.evaluate(s.expression, scope));
        seriesData[s.key].push(Number.isFinite(val) ? val : 0);
      } catch {
        seriesData[s.key].push(0);
      }
    }
  }

  return { xValues, seriesData };
}

/**
 * Runs mandatory automatic verification of an ExplorableLabSpec against all
 * worked numeric examples in the section plus assumption checks and an
 * independent numerical grid check (when applicable).
 */
export function verifyLabSpec(spec: ExplorableLabSpec): LabCertificate {
  const trace: string[] = [];
  const failureReasons: string[] = [];
  const checks: ExampleCheckDetail[] = [];

  trace.push(`Starting verification for lab "${spec.title}" (${spec.id}) anchored to §${spec.sectionId} p.${spec.anchor.page}.`);

  if (!spec.workedExamples || spec.workedExamples.length === 0) {
    failureReasons.push('Lab specification contains no worked numeric examples to verify against.');
  }

  // 1. Check domain assumptions at default parameter values
  const defaultParams: Record<string, number> = {};
  for (const p of spec.parameters) {
    defaultParams[p.name] = p.defaultValue;
  }

  let assumptionsPassed = true;
  for (const assump of spec.assumptions || []) {
    try {
      const res = Boolean(math.evaluate(assump.expression, defaultParams));
      if (!res) {
        assumptionsPassed = false;
        failureReasons.push(`Assumption "${assump.name}" (${assump.expression}) failed at default parameters.`);
      } else {
        trace.push(`Assumption [${assump.name}] holds (${assump.description}).`);
      }
    } catch (err) {
      assumptionsPassed = false;
      failureReasons.push(`Error evaluating assumption "${assump.name}": ${(err as Error).message}`);
    }
  }

  // 2. Verify every worked numeric example in the section
  for (const ex of spec.workedExamples) {
    const tol = ex.tolerance ?? 1e-6;
    const mergedInputs = { ...defaultParams, ...ex.inputs };

    let outputs: Record<string, number>;
    try {
      outputs = evaluateLabFormulas(spec, mergedInputs);
    } catch (err) {
      const msg = `Evaluation error on example "${ex.title}": ${(err as Error).message}`;
      failureReasons.push(msg);
      checks.push({
        exampleId: ex.id,
        title: ex.title,
        outputName: 'EVAL_ERROR',
        expected: 0,
        actual: NaN,
        absError: Infinity,
        passed: false,
        reason: msg,
      });
      continue;
    }

    for (const [outKey, expectedVal] of Object.entries(ex.expected)) {
      const actualVal = outputs[outKey];
      if (actualVal === undefined || Number.isNaN(actualVal)) {
        const reason = `Missing output formula "${outKey}" required by "${ex.title}".`;
        failureReasons.push(reason);
        checks.push({
          exampleId: ex.id,
          title: ex.title,
          outputName: outKey,
          expected: expectedVal,
          actual: NaN,
          absError: Infinity,
          passed: false,
          reason,
        });
        continue;
      }

      const absError = Math.abs(actualVal - expectedVal);
      const passed = absError <= tol;
      if (!passed) {
        const reason = `${ex.title}: "${outKey}" expected ${expectedVal.toFixed(6)}, got ${actualVal.toFixed(6)} (|err| = ${absError.toExponential(2)} > tol ${tol}).`;
        failureReasons.push(reason);
        trace.push(`FAIL: ${reason}`);
      } else {
        trace.push(
          `PASS [${ex.title}] ${outKey} = ${actualVal.toFixed(6)} (expected ${expectedVal.toFixed(6)}, |err| = ${absError.toExponential(2)}).`
        );
      }

      checks.push({
        exampleId: ex.id,
        title: ex.title,
        outputName: outKey,
        expected: expectedVal,
        actual: actualVal,
        absError,
        passed,
        reason: passed ? undefined : `Expected ${expectedVal}, got ${actualVal}`,
      });
    }
  }

  // 3. Independent grid-search optimality certificate check for Bolton §4.2
  let kktOrGridResidual: number | undefined;
  if (
    spec.formulas.some((f) => f.name === 's_star') &&
    spec.formulas.some((f) => f.name === 'pi_sb') &&
    defaultParams.c !== undefined &&
    defaultParams.eta !== undefined &&
    defaultParams.sigma !== undefined
  ) {
    try {
      const out = evaluateLabFormulas(spec, defaultParams);
      const { c, eta, sigma, wbar = 0 } = defaultParams;
      // Independent grid maximization of Principal expected surplus over s in [0, 1]
      let bestGridPi = -Infinity;
      let bestGridS = 0;
      const N = 2000;
      for (let i = 0; i <= N; i++) {
        const sCand = i / N;
        const aCand = sCand / c;
        // Total certainty-equivalent surplus: E[q] - c*a^2/2 - eta*s^2*sigma^2/2 - wbar
        const piCand =
          aCand - 0.5 * c * aCand * aCand - 0.5 * eta * sCand * sCand * sigma * sigma - wbar;
        if (piCand > bestGridPi) {
          bestGridPi = piCand;
          bestGridS = sCand;
        }
      }
      const gapS = Math.abs(out.s_star - bestGridS);
      const gapPi = Math.abs(out.pi_sb - bestGridPi);
      kktOrGridResidual = Math.max(gapS, gapPi);
      trace.push(
        `Independent 2000-point grid solver check: s_grid=${bestGridS.toFixed(6)} vs s*=${out.s_star.toFixed(6)}, pi_grid=${bestGridPi.toFixed(6)} vs pi_sb=${out.pi_sb.toFixed(6)} (residual=${kktOrGridResidual.toExponential(2)}).`
      );
      if (gapPi > 1e-4 || gapS > 1e-3) {
        failureReasons.push(
          `Independent numerical grid optimization disagreed with formula output (s_grid=${bestGridS.toFixed(4)} vs s*=${out.s_star.toFixed(4)}, pi_grid=${bestGridPi.toFixed(4)} vs pi_sb=${out.pi_sb.toFixed(4)}).`
        );
      }
    } catch (err) {
      failureReasons.push(`Grid optimality check failed: ${(err as Error).message}`);
    }
  }

  const passed =
    assumptionsPassed &&
    checks.length > 0 &&
    checks.every((c) => c.passed) &&
    failureReasons.length === 0;

  return {
    labId: spec.id,
    verifiedAt: new Date().toISOString(),
    passed,
    assumptionsPassed,
    checks,
    kktOrGridResidual,
    failureReasons,
    trace,
  };
}
