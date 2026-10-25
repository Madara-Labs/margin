// ============================================================================
// Method 3: Retrieval Maps (Concept Map from Memory + Reference Diff Overlay)
// Evidence base: Karpicke & Blunt (2011) — Drawing a concept map from memory
// works as well as free recall and preserves whole-chapter structure.
// Fully Interactive Canvas:
// - Drag & drop nodes smoothly anywhere on the SVG canvas.
// - Double-click empty canvas to create a node right at that position.
// - Click nodes to select, edit label, connect directed arrows, or delete.
// - Click edges to select, edit label, or delete.
// - Reveal reference map diff overlay directly on the canvas and in the diff panel.
// ============================================================================

import React, { useRef, useState } from 'react';
import {
  ConceptEdge,
  ConceptMapSpec,
  ConceptNode,
  RetrievalMapAttempt,
} from '../types/margin';
import { computeRetrievalMapDiff } from '../lib/recallEvaluator';

interface RetrievalMapCanvasProps {
  bookId: string;
  chapterId: string;
  referenceMap: ConceptMapSpec;
  attempt?: RetrievalMapAttempt;
  onSaveAttempt: (attempt: RetrievalMapAttempt) => void;
  onJumpToAnchor: (page: number, paragraphId?: string) => void;
}

const DEFAULT_SEED_NODES: ConceptNode[] = [
  { id: 'rn-1', label: 'Linear Contract w = t + sq', x: 160, y: 110 },
  { id: 'rn-2', label: 'CARA Certainty Equivalent & Risk Premium', x: 490, y: 110 },
  { id: 'rn-3', label: 'Agent IC Effort a* = s/c', x: 160, y: 280 },
  { id: 'rn-4', label: 'Optimal Slope s* = 1/(1 + ηcσ²)', x: 490, y: 280 },
];

const DEFAULT_SEED_EDGES: ConceptEdge[] = [
  { id: 're-1', source: 'rn-1', target: 'rn-2', label: 'normal noise σ²' },
  { id: 're-2', source: 'rn-2', target: 'rn-3', label: 'FOC ∂ŵ/∂a = 0' },
  { id: 're-3', source: 'rn-3', target: 'rn-4', label: 'risk-incentive trade-off' },
];

export const RetrievalMapCanvas: React.FC<RetrievalMapCanvasProps> = ({
  bookId,
  chapterId,
  referenceMap,
  attempt,
  onSaveAttempt,
  onJumpToAnchor,
}) => {
  const [nodes, setNodes] = useState<ConceptNode[]>(
    attempt?.readerNodes && attempt.readerNodes.length > 0
      ? attempt.readerNodes
      : DEFAULT_SEED_NODES
  );

  const [edges, setEdges] = useState<ConceptEdge[]>(
    attempt?.readerEdges || DEFAULT_SEED_EDGES
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingLabelText, setEditingLabelText] = useState<string>('');

  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editingEdgeText, setEditingEdgeText] = useState<string>('');

  const [newNodeLabel, setNewNodeLabel] = useState<string>('');
  const [edgeSource, setEdgeSource] = useState<string>(nodes[0]?.id || '');
  const [edgeTarget, setEdgeTarget] = useState<string>(nodes[1]?.id || '');
  const [edgeLabel, setEdgeLabel] = useState<string>('');
  const [revealed, setRevealed] = useState<boolean>(
    Boolean(attempt?.revealedReference)
  );

  // Dragging state
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragState, setDragState] = useState<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const persist = (
    nextNodes: ConceptNode[],
    nextEdges: ConceptEdge[],
    nextRevealed: boolean
  ) => {
    const diff = nextRevealed
      ? computeRetrievalMapDiff(nextNodes, nextEdges, referenceMap)
      : undefined;
    onSaveAttempt({
      id: `map-${bookId}-ch${chapterId}`,
      bookId,
      chapterId,
      readerNodes: nextNodes,
      readerEdges: nextEdges,
      revealedReference: nextRevealed,
      diff,
      updatedAt: new Date().toISOString(),
    });
  };

  // Convert browser mouse/pointer coordinates to SVG viewBox space (0..720, 0..400)
  const getSvgCoordinates = (
    clientX: number,
    clientY: number
  ): { x: number; y: number } => {
    if (!svgRef.current) return { x: 360, y: 200 };
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const globalPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    return {
      x: Math.max(90, Math.min(630, Math.round(globalPt.x))),
      y: Math.max(30, Math.min(370, Math.round(globalPt.y))),
    };
  };

  // Start dragging a node
  const handleNodePointerDown = (
    e: React.PointerEvent<SVGGElement>,
    node: ConceptNode
  ) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);

    // If we're in arrow-connecting mode and click another node, complete the edge!
    if (connectingFromId) {
      if (connectingFromId !== node.id) {
        const newEdge: ConceptEdge = {
          id: `re-${Date.now()}`,
          source: connectingFromId,
          target: node.id,
          label: 'implies',
        };
        const nextEdges = [...edges, newEdge];
        setEdges(nextEdges);
        setConnectingFromId(null);
        setSelectedNodeId(node.id);
        persist(nodes, nextEdges, revealed);
      } else {
        setConnectingFromId(null);
      }
      return;
    }

    const coords = getSvgCoordinates(e.clientX, e.clientY);
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setDragState({
      nodeId: node.id,
      offsetX: coords.x - node.x,
      offsetY: coords.y - node.y,
    });
  };

  // Drag node across SVG
  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState) return;
    const coords = getSvgCoordinates(e.clientX, e.clientY);
    const updatedX = Math.max(90, Math.min(630, coords.x - dragState.offsetX));
    const updatedY = Math.max(30, Math.min(370, coords.y - dragState.offsetY));

    setNodes((prev) =>
      prev.map((n) =>
        n.id === dragState.nodeId ? { ...n, x: updatedX, y: updatedY } : n
      )
    );
  };

  // Release node drag and persist
  const handleSvgPointerUp = () => {
    if (dragState) {
      persist(nodes, edges, revealed);
      setDragState(null);
    }
  };

  // Double-click SVG background to create a new concept node at that spot
  const handleSvgDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getSvgCoordinates(e.clientX, e.clientY);
    const newId = `rn-${Date.now()}`;
    const defaultTitle = `Concept ${nodes.length + 1}`;
    const created: ConceptNode = {
      id: newId,
      label: defaultTitle,
      x: coords.x,
      y: coords.y,
    };
    const nextNodes = [...nodes, created];
    setNodes(nextNodes);
    setSelectedNodeId(newId);
    setSelectedEdgeId(null);
    setEditingNodeId(newId);
    setEditingLabelText(defaultTitle);
    persist(nextNodes, edges, revealed);
  };

  // Add node via top form
  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeLabel.trim()) return;
    const idx = nodes.length;
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const created: ConceptNode = {
      id: `rn-${Date.now()}`,
      label: newNodeLabel.trim(),
      x: 140 + col * 220,
      y: 90 + (row % 3) * 110,
    };
    const nextNodes = [...nodes, created];
    setNodes(nextNodes);
    setNewNodeLabel('');
    setSelectedNodeId(created.id);
    setSelectedEdgeId(null);
    if (!edgeSource) setEdgeSource(created.id);
    setEdgeTarget(created.id);
    persist(nextNodes, edges, revealed);
  };

  // Add edge via top form
  const handleAddEdge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!edgeSource || !edgeTarget || edgeSource === edgeTarget) return;
    const created: ConceptEdge = {
      id: `re-${Date.now()}`,
      source: edgeSource,
      target: edgeTarget,
      label: edgeLabel.trim() || 'implies',
    };
    const nextEdges = [...edges, created];
    setEdges(nextEdges);
    setEdgeLabel('');
    persist(nodes, nextEdges, revealed);
  };

  // Delete currently selected node
  const handleDeleteNode = (id: string) => {
    const nextNodes = nodes.filter((n) => n.id !== id);
    const nextEdges = edges.filter((e) => e.source !== id && e.target !== id);
    setNodes(nextNodes);
    setEdges(nextEdges);
    if (selectedNodeId === id) setSelectedNodeId(null);
    if (connectingFromId === id) setConnectingFromId(null);
    persist(nextNodes, nextEdges, revealed);
  };

  // Delete currently selected edge
  const handleDeleteEdge = (id: string) => {
    const nextEdges = edges.filter((e) => e.id !== id);
    setEdges(nextEdges);
    if (selectedEdgeId === id) setSelectedEdgeId(null);
    persist(nodes, nextEdges, revealed);
  };

  // Save edited node label
  const handleSaveNodeLabel = (id: string) => {
    if (!editingLabelText.trim()) return;
    const nextNodes = nodes.map((n) =>
      n.id === id ? { ...n, label: editingLabelText.trim() } : n
    );
    setNodes(nextNodes);
    setEditingNodeId(null);
    persist(nextNodes, edges, revealed);
  };

  // Save edited edge label
  const handleSaveEdgeLabel = (id: string) => {
    if (!editingEdgeText.trim()) return;
    const nextEdges = edges.map((e) =>
      e.id === id ? { ...e, label: editingEdgeText.trim() } : e
    );
    setEdges(nextEdges);
    setEditingEdgeId(null);
    persist(nodes, nextEdges, revealed);
  };

  const handleRevealDiff = () => {
    if (nodes.length < 2 || edges.length < 1) return;
    setRevealed(true);
    persist(nodes, edges, true);
  };

  const handleResetSeed = () => {
    setNodes(DEFAULT_SEED_NODES);
    setEdges(DEFAULT_SEED_EDGES);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectingFromId(null);
    persist(DEFAULT_SEED_NODES, DEFAULT_SEED_EDGES, revealed);
  };

  const handleClearCanvas = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectingFromId(null);
    persist([], [], revealed);
  };

  const diff = revealed
    ? computeRetrievalMapDiff(nodes, edges, referenceMap)
    : null;

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  return (
    <section
      className="instrument-card map-instrument"
      aria-label="Retrieval Concept Map"
    >
      <div className="instrument-header">
        <div>
          <span className="instrument-badge">
            Method 3 · Retrieval Map (Interactive Canvas from Memory)
          </span>
          <h3 className="instrument-title">
            Chapter {chapterId} Retrieval Map — Drag, Connect & Test Your Mental Model
          </h3>
          <p className="instrument-subtitle">
            Drag nodes, double-click to add, and click nodes to connect directed arrows.
            When you finish your attempt, overlay the reference map diff to check your gaps.
          </p>
        </div>
        <div className="instrument-meta-actions">
          <button
            type="button"
            className="btn-quiet"
            onClick={handleResetSeed}
            title="Restore example starting nodes"
          >
            Reset Practice Map
          </button>
          <button
            type="button"
            className="btn-quiet"
            onClick={handleClearCanvas}
            title="Clear all nodes to build strictly from memory"
          >
            Clear Canvas
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={nodes.length < 2 || edges.length < 1}
            onClick={handleRevealDiff}
          >
            {revealed
              ? '✓ Reference Diff Active'
              : 'Reveal Reference Map Diff Overlay'}
          </button>
          {revealed && (
            <button
              type="button"
              className="btn-quiet"
              onClick={() => {
                setRevealed(false);
                persist(nodes, edges, false);
              }}
            >
              Hide Reference Overlay
            </button>
          )}
        </div>
      </div>

      {/* Quick Interactive Tool Banner for Selected Element */}
      {connectingFromId && (
        <div className="map-connecting-banner" role="status">
          <span>
            🔗 <strong>Connecting arrow:</strong> Click any destination node on
            the canvas (or click here to cancel).
          </span>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => setConnectingFromId(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {selectedNode && !connectingFromId && (
        <div className="map-selected-bar">
          <div className="map-selected-meta">
            <strong>Selected Node:</strong>
            {editingNodeId === selectedNode.id ? (
              <span className="map-inline-edit-wrap">
                <input
                  type="text"
                  value={editingLabelText}
                  autoFocus
                  onChange={(e) => setEditingLabelText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNodeLabel(selectedNode.id);
                    if (e.key === 'Escape') setEditingNodeId(null);
                  }}
                />
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => handleSaveNodeLabel(selectedNode.id)}
                >
                  Save
                </button>
              </span>
            ) : (
              <span className="map-selected-label">“{selectedNode.label}”</span>
            )}
          </div>
          <div className="map-selected-actions">
            {editingNodeId !== selectedNode.id && (
              <button
                type="button"
                className="btn-quiet"
                onClick={() => {
                  setEditingNodeId(selectedNode.id);
                  setEditingLabelText(selectedNode.label);
                }}
              >
                ✎ Rename
              </button>
            )}
            <button
              type="button"
              className="btn-quiet active-toggle"
              onClick={() => setConnectingFromId(selectedNode.id)}
              title="Click another node to draw an arrow to it"
            >
              🔗 Connect Arrow →
            </button>
            <button
              type="button"
              className="btn-quiet btn-danger-quiet"
              onClick={() => handleDeleteNode(selectedNode.id)}
              title="Delete this node and its edges"
            >
              × Delete Node
            </button>
            <button
              type="button"
              className="btn-quiet"
              onClick={() => setSelectedNodeId(null)}
              title="Deselect node"
            >
              ✕ Done
            </button>
          </div>
        </div>
      )}

      {selectedEdge && (
        <div className="map-selected-bar">
          <div className="map-selected-meta">
            <strong>Selected Link:</strong>
            {editingEdgeId === selectedEdge.id ? (
              <span className="map-inline-edit-wrap">
                <input
                  type="text"
                  value={editingEdgeText}
                  autoFocus
                  onChange={(e) => setEditingEdgeText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdgeLabel(selectedEdge.id);
                    if (e.key === 'Escape') setEditingEdgeId(null);
                  }}
                />
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => handleSaveEdgeLabel(selectedEdge.id)}
                >
                  Save
                </button>
              </span>
            ) : (
              <span className="map-selected-label">“{selectedEdge.label}”</span>
            )}
          </div>
          <div className="map-selected-actions">
            {editingEdgeId !== selectedEdge.id && (
              <button
                type="button"
                className="btn-quiet"
                onClick={() => {
                  setEditingEdgeId(selectedEdge.id);
                  setEditingEdgeText(selectedEdge.label);
                }}
              >
                ✎ Edit Label
              </button>
            )}
            <button
              type="button"
              className="btn-quiet btn-danger-quiet"
              onClick={() => handleDeleteEdge(selectedEdge.id)}
            >
              × Delete Arrow
            </button>
          </div>
        </div>
      )}

      {/* Quick Add Forms */}
      <div className="map-builder-forms">
        <form onSubmit={handleAddNode} className="map-form-inline">
          <input
            type="text"
            placeholder="Add concept node (or double-click canvas)..."
            value={newNodeLabel}
            onChange={(e) => setNewNodeLabel(e.target.value)}
          />
          <button type="submit" className="btn-quiet">
            + Add Node
          </button>
        </form>

        <form onSubmit={handleAddEdge} className="map-form-inline">
          <select
            value={edgeSource}
            onChange={(e) => setEdgeSource(e.target.value)}
            aria-label="Source Node"
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                From: {n.label.slice(0, 24)}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Arrow label (e.g. 'FOC ∂ŵ/∂a = 0')"
            value={edgeLabel}
            onChange={(e) => setEdgeLabel(e.target.value)}
          />
          <select
            value={edgeTarget}
            onChange={(e) => setEdgeTarget(e.target.value)}
            aria-label="Target Node"
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                To: {n.label.slice(0, 24)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-quiet">
            + Link Arrow
          </button>
        </form>
      </div>

      {/* Interactive SVG Concept Map Canvas */}
      <div className="map-canvas-container">
        <div className="map-canvas-hints">
          <span>💡 <strong>Drag</strong> nodes to move</span>
          <span>• <strong>Double-click canvas</strong> to spawn a node</span>
          <span>• <strong>Click a node</strong> to connect or delete</span>
          <span>• <strong>Click an arrow</strong> to edit</span>
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 720 400"
          className="retrieval-map-svg interactive-map-svg"
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onDoubleClick={handleSvgDoubleClick}
        >
          <defs>
            <marker
              id="arrow-reader"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
            </marker>
            <marker
              id="arrow-selected"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#d97706" />
            </marker>
            <marker
              id="arrow-reference"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#16a34a" />
            </marker>
          </defs>

          {/* Canvas Background Grid — click empty space to deselect */}
          <pattern
            id="map-grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1" fill="var(--border-subtle)" opacity="0.6" />
          </pattern>
          <rect
            width="100%"
            height="100%"
            fill="url(#map-grid)"
            onClick={() => {
              if (!connectingFromId) {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }
            }}
          />

          {/* Reference overlay missing edges (when revealed) */}
          {revealed &&
            diff?.missingReferenceEdges.map((me) => {
              const s = referenceMap.nodes.find((n) => n.id === me.source);
              const t = referenceMap.nodes.find((n) => n.id === me.target);
              if (!s || !t) return null;
              return (
                <g key={`ref-${me.id}`} opacity="0.65">
                  <line
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke="#16a34a"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    markerEnd="url(#arrow-reference)"
                  />
                  <text
                    x={(s.x + t.x) / 2}
                    y={(s.y + t.y) / 2 - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#15803d"
                    fontWeight="600"
                  >
                    {me.label}
                  </text>
                </g>
              );
            })}

          {/* Reader's directed edges */}
          {edges.map((edge) => {
            const s = nodes.find((n) => n.id === edge.source);
            const t = nodes.find((n) => n.id === edge.target);
            if (!s || !t) return null;
            const isSelected = selectedEdgeId === edge.id;
            const midX = (s.x + t.x) / 2;
            const midY = (s.y + t.y) / 2 - 8;

            return (
              <g
                key={edge.id}
                className={`map-edge-group ${isSelected ? 'edge-selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
                  setConnectingFromId(null);
                }}
              >
                {/* Fat invisible hit stroke for easy clicking */}
                <line
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke="transparent"
                  strokeWidth={14}
                  cursor="pointer"
                />
                <line
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={isSelected ? '#d97706' : '#2563eb'}
                  strokeWidth={isSelected ? 3 : 2}
                  markerEnd={
                    isSelected ? 'url(#arrow-selected)' : 'url(#arrow-reader)'
                  }
                  cursor="pointer"
                />
                <rect
                  x={midX - Math.max(30, edge.label.length * 3.4)}
                  y={midY - 10}
                  width={Math.max(60, edge.label.length * 6.8)}
                  height={18}
                  rx={4}
                  fill="var(--bg-elevated)"
                  stroke={isSelected ? '#d97706' : 'var(--border-subtle)'}
                  strokeWidth={1}
                  cursor="pointer"
                />
                <text
                  x={midX}
                  y={midY + 3}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isSelected ? '#b45309' : '#1d4ed8'}
                  fontWeight="600"
                  cursor="pointer"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}

          {/* Reference overlay missing nodes (when revealed) */}
          {revealed &&
            diff?.missingReferenceNodes.map((rn) => (
              <g
                key={`rn-missing-${rn.id}`}
                transform={`translate(${rn.x}, ${rn.y})`}
                className="ref-missing-node-group"
                onClick={() => {
                  if (rn.anchor) {
                    onJumpToAnchor(rn.anchor.page, rn.anchor.paragraphId);
                  }
                }}
              >
                <rect
                  x={-95}
                  y={-22}
                  width={190}
                  height={44}
                  rx={8}
                  fill="#fef3c7"
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  cursor="pointer"
                />
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#92400e"
                  cursor="pointer"
                >
                  {rn.label.length > 28
                    ? `${rn.label.slice(0, 26)}…`
                    : rn.label}
                </text>
                <text
                  x={0}
                  y={14}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="#b45309"
                  fontWeight="500"
                  cursor="pointer"
                >
                  GAP: Reference Concept (Jump p.{rn.anchor?.page || '?'})
                </text>
              </g>
            ))}

          {/* Reader's concept nodes */}
          {nodes.map((node) => {
            const isMatched = diff?.matchedNodeIds.includes(node.id);
            const isSelected = selectedNodeId === node.id;
            const isConnecting = connectingFromId === node.id;
            const isTargetCandidate = connectingFromId && connectingFromId !== node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className={`map-node-group ${
                  isSelected ? 'node-selected' : ''
                } ${isConnecting ? 'node-connecting-source' : ''} ${
                  isTargetCandidate ? 'node-target-candidate' : ''
                }`}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                }}
                style={{ cursor: isTargetCandidate ? 'crosshair' : 'grab' }}
              >
                {/* Node Box */}
                <rect
                  x={-95}
                  y={-22}
                  width={190}
                  height={44}
                  rx={8}
                  fill={
                    isSelected
                      ? '#eff6ff'
                      : isMatched
                      ? '#dcfce7'
                      : 'var(--bg-elevated)'
                  }
                  stroke={
                    isSelected
                      ? '#1d4ed8'
                      : isConnecting
                      ? '#d97706'
                      : isMatched
                      ? '#16a34a'
                      : 'var(--border-strong)'
                  }
                  strokeWidth={isSelected || isConnecting ? 3 : 2}
                  filter={
                    isSelected
                      ? 'drop-shadow(0 4px 10px rgba(29, 78, 216, 0.2))'
                      : 'none'
                  }
                />

                {/* Node Label */}
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--text-primary)"
                  style={{ userSelect: 'none' }}
                >
                  {node.label.length > 28
                    ? `${node.label.slice(0, 26)}…`
                    : node.label}
                </text>

                {/* Connection Handle Circle on Right Margin */}
                <circle
                  cx={95}
                  cy={0}
                  r={isSelected ? 6 : 4}
                  fill={isConnecting ? '#d97706' : '#2563eb'}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  cursor="pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConnectingFromId(node.id);
                    setSelectedNodeId(node.id);
                  }}
                >
                  <title>Click to draw arrow</title>
                </circle>

                {/* Delete button 'x' visible when selected */}
                {isSelected && (
                  <g
                    transform="translate(85, -20)"
                    cursor="pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNode(node.id);
                    }}
                  >
                    <circle cx={0} cy={0} r={8} fill="#ef4444" />
                    <text
                      x={0}
                      y={3.5}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#ffffff"
                      fontWeight="bold"
                    >
                      ×
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Diff Overlay Comparison Panel (Only after reader reveals reference map) */}
      {revealed && diff && (
        <div className="map-diff-overlay" role="region" aria-label="Concept Map Diff">
          <div className="map-diff-col">
            <h4>
              ✓ Concepts You Recalled ({diff.matchedNodeIds.length} /{' '}
              {referenceMap.nodes.length})
            </h4>
            <ul>
              {referenceMap.nodes
                .filter((rn) => !diff.missingReferenceNodes.some((m) => m.id === rn.id))
                .map((rn) => (
                  <li key={rn.id} className="diff-item-matched">
                    <span>✓ {rn.label}</span>
                    {rn.anchor && (
                      <button
                        type="button"
                        className="anchor-pill"
                        onClick={() =>
                          onJumpToAnchor(rn.anchor!.page, rn.anchor!.paragraphId)
                        }
                      >
                        p. {rn.anchor.page}
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </div>

          <div className="map-diff-col">
            <h4>
              ◌ Missing Reference Concepts & Links ({diff.missingReferenceNodes.length}{' '}
              nodes, {diff.missingReferenceEdges.length} links)
            </h4>
            <ul>
              {diff.missingReferenceNodes.map((mn) => (
                <li key={mn.id} className="diff-item-missing">
                  <span>GAP: {mn.label}</span>
                  {mn.anchor && (
                    <button
                      type="button"
                      className="anchor-pill"
                      onClick={() =>
                        onJumpToAnchor(mn.anchor!.page, mn.anchor!.paragraphId)
                      }
                    >
                      Jump to p. {mn.anchor.page}
                    </button>
                  )}
                </li>
              ))}
              {diff.missingReferenceEdges.slice(0, 4).map((me) => {
                const src =
                  referenceMap.nodes.find((n) => n.id === me.source)?.label ||
                  me.source;
                const tgt =
                  referenceMap.nodes.find((n) => n.id === me.target)?.label ||
                  me.target;
                return (
                  <li key={me.id} className="diff-item-missing-edge">
                    <span>
                      Missing link: <strong>{src}</strong> —({me.label})→{' '}
                      <strong>{tgt}</strong>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
