// ============================================================================
// Coverage & Diff Comparison Engines for Methods 2 & 3
// Principle: The AI/instrument marks structural coverage against the section's
// key ideas and concept relationships; it NEVER grades the reader's prose.
// ============================================================================

import {
  ConceptEdge,
  ConceptMapSpec,
  ConceptNode,
  KeyIdeaCoverage,
  MapDiffResult,
  SectionKeyIdea,
} from '../types/margin';

/**
 * Evaluates a reader's free recall attempt against the section's key ideas.
 * Marks each idea with 'covered' (✓), 'partial', or 'gap' and extracts the
 * matching phrase from the reader's own words.
 */
export function evaluateFreeRecallCoverage(
  readerText: string,
  keyIdeas: SectionKeyIdea[]
): KeyIdeaCoverage[] {
  const normalizedText = readerText.toLowerCase();
  const sentences = readerText
    .split(/(?<=[.!?;\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return keyIdeas.map((idea) => {
    const matchedKeywords = idea.keywords.filter((kw) =>
      normalizedText.includes(kw.toLowerCase())
    );

    const ratio =
      idea.keywords.length > 0
        ? matchedKeywords.length / idea.keywords.length
        : 0;

    let status: 'covered' | 'partial' | 'gap' = 'gap';
    if (matchedKeywords.length >= 2 || ratio >= 0.5) {
      status = 'covered';
    } else if (matchedKeywords.length === 1) {
      status = 'partial';
    }

    // Find the best sentence from the reader's own attempt to highlight
    let matchedReaderPhrase: string | undefined;
    if (matchedKeywords.length > 0) {
      const bestSentence = sentences.find((s) =>
        matchedKeywords.some((kw) => s.toLowerCase().includes(kw.toLowerCase()))
      );
      matchedReaderPhrase = bestSentence || matchedKeywords.join(', ');
    }

    return {
      ideaId: idea.id,
      status,
      matchedReaderPhrase,
      note:
        status === 'covered'
          ? `Matched concepts: ${matchedKeywords.join(', ')}`
          : status === 'partial'
            ? `Partially touched (${matchedKeywords.join(', ')}); check full relation on p.${idea.anchor.page}`
            : `Not mentioned yet — revisit p.${idea.anchor.page}`,
    };
  });
}

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9*]+/g, ' ')
    .trim();
}

function labelsMatch(a: string, b: string): boolean {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  const tokensA = new Set(na.split(' ').filter((w) => w.length > 2));
  const tokensB = new Set(nb.split(' ').filter((w) => w.length > 2));
  for (const t of tokensA) {
    if (tokensB.has(t)) return true;
  }
  return false;
}

/**
 * Computes a structural diff between the reader's memory-drawn concept map
 * and the chapter's reference map (Karpicke & Blunt, 2011).
 */
export function computeRetrievalMapDiff(
  readerNodes: ConceptNode[],
  readerEdges: ConceptEdge[],
  referenceMap: ConceptMapSpec
): MapDiffResult {
  const matchedNodeIds: string[] = [];
  const matchedRefNodeIds = new Set<string>();
  const refToReaderNodeMap = new Map<string, string>();

  for (const refNode of referenceMap.nodes) {
    const readerMatch = readerNodes.find((rn) =>
      labelsMatch(rn.label, refNode.label)
    );
    if (readerMatch) {
      matchedNodeIds.push(readerMatch.id);
      matchedRefNodeIds.add(refNode.id);
      refToReaderNodeMap.set(refNode.id, readerMatch.id);
    }
  }

  const missingReferenceNodes = referenceMap.nodes.filter(
    (rn) => !matchedRefNodeIds.has(rn.id)
  );

  const extraReaderNodes = readerNodes.filter(
    (rn) => !matchedNodeIds.includes(rn.id)
  );

  const matchedEdgeIds: string[] = [];
  const missingReferenceEdges: ConceptEdge[] = [];

  const getReaderNodeLabel = (id: string) =>
    readerNodes.find((n) => n.id === id)?.label || id;
  const getRefNodeLabel = (id: string) =>
    referenceMap.nodes.find((n) => n.id === id)?.label || id;

  for (const refEdge of referenceMap.edges) {
    const refSrcLabel = getRefNodeLabel(refEdge.source);
    const refTgtLabel = getRefNodeLabel(refEdge.target);

    const matchingReaderEdge = readerEdges.find((re) => {
      const rSrc = getReaderNodeLabel(re.source);
      const rTgt = getReaderNodeLabel(re.target);
      return (
        (labelsMatch(rSrc, refSrcLabel) && labelsMatch(rTgt, refTgtLabel)) ||
        (labelsMatch(rSrc, refTgtLabel) && labelsMatch(rTgt, refSrcLabel))
      );
    });

    if (matchingReaderEdge) {
      matchedEdgeIds.push(matchingReaderEdge.id);
    } else {
      missingReferenceEdges.push(refEdge);
    }
  }

  return {
    matchedNodeIds,
    missingReferenceNodes,
    extraReaderNodes,
    matchedEdgeIds,
    missingReferenceEdges,
  };
}
