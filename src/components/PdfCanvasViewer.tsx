// ============================================================================
// PDF.js Canvas + Selectable Text Layer Component
// Renders either the reader's uploaded PDF file or their local Bolton PDF
// (streamed via /api/local-pdf/bolton) with continuous page navigation,
// zoom, and selectable text anchoring.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PdfCropRegion } from '../types/margin';

// Configure PDF.js worker using Vite URL import
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
if (typeof pdfWorkerUrl === 'string' && pdfWorkerUrl) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

// Shared cache of loaded PDFDocumentProxy instances and rendered page canvases
const pdfDocCache = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>();
const pdfPageCanvasCache = new Map<
  string,
  Promise<{ canvas: HTMLCanvasElement; pageWidth: number; pageHeight: number; scale: number }>
>();

function getPdfSourceKey(source: File | string): string {
  if (typeof source === 'string') return `url:${source}`;
  return `file:${source.name}:${source.size}:${source.lastModified}`;
}

async function getCachedPdfDocument(
  source: File | string
): Promise<pdfjsLib.PDFDocumentProxy> {
  const key = getPdfSourceKey(source);
  const existing = pdfDocCache.get(key);
  if (existing) return existing;

  const promise = (async () => {
    if (typeof source === 'string') {
      return await pdfjsLib.getDocument(source).promise;
    } else {
      const buf = await source.arrayBuffer();
      return await pdfjsLib.getDocument({ data: buf }).promise;
    }
  })();

  pdfDocCache.set(key, promise);
  promise.catch(() => pdfDocCache.delete(key));
  return promise;
}

async function getCachedPageCanvas(
  source: File | string,
  pdfPage: number,
  scale = 1.85
): Promise<{ canvas: HTMLCanvasElement; pageWidth: number; pageHeight: number; scale: number }> {
  const key = `${getPdfSourceKey(source)}#p${pdfPage}@${scale}`;
  const existing = pdfPageCanvasCache.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const doc = await getCachedPdfDocument(source);
    const safePage = Math.max(1, Math.min(doc.numPages, pdfPage));
    const page = await doc.getPage(safePage);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale });

    const offscreen = document.createElement('canvas');
    offscreen.width = Math.ceil(viewport.width);
    offscreen.height = Math.ceil(viewport.height);
    const ctx = offscreen.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
    }

    // Keep cache bounded to 16 rendered pages
    if (pdfPageCanvasCache.size > 16) {
      const oldestKey = pdfPageCanvasCache.keys().next().value;
      if (oldestKey) pdfPageCanvasCache.delete(oldestKey);
    }

    return {
      canvas: offscreen,
      pageWidth: baseViewport.width,
      pageHeight: baseViewport.height,
      scale,
    };
  })();

  pdfPageCanvasCache.set(key, promise);
  promise.catch(() => pdfPageCanvasCache.delete(key));
  return promise;
}

interface PdfRegionCropProps {
  pdfSource: File | string | null;
  crop: PdfCropRegion;
  kind?: 'figure' | 'equation';
  onOpenPdfPage?: (pdfPage: number) => void;
}

export const PdfRegionCrop: React.FC<PdfRegionCropProps> = ({
  pdfSource,
  crop,
  kind = 'figure',
  onOpenPdfPage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!pdfSource) return;
    let cancelled = false;
    setFailed(false);

    getCachedPageCanvas(pdfSource, crop.pdfPage, 1.85)
      .then(({ canvas: srcCanvas, pageWidth, pageHeight, scale }) => {
        if (cancelled || !canvasRef.current) return;
        const dstCanvas = canvasRef.current;
        const ctx = dstCanvas.getContext('2d');
        if (!ctx) return;

        const yTop = Math.min(pageHeight, Math.max(0, crop.yTop));
        const yBottom = Math.max(0, Math.min(yTop - 14, crop.yBottom));

        const leftPt = Math.round(pageWidth * 0.11);
        const rightPt = Math.round(pageWidth * 0.92);
        const widthPt = Math.max(120, rightPt - leftPt);

        const sx = Math.max(0, Math.floor(leftPt * scale));
        const sy = Math.max(0, Math.floor((pageHeight - yTop) * scale));
        const sw = Math.min(srcCanvas.width - sx, Math.ceil(widthPt * scale));
        const sh = Math.min(
          srcCanvas.height - sy,
          Math.max(24, Math.ceil((yTop - yBottom) * scale))
        );

        dstCanvas.width = sw;
        dstCanvas.height = sh;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sw, sh);
        ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [pdfSource, crop.pdfPage, crop.yTop, crop.yBottom]);

  if (!pdfSource || failed) {
    return null;
  }

  return (
    <figure
      className={`pdf-inline-crop ${
        kind === 'equation' ? 'pdf-inline-crop-equation' : 'pdf-inline-crop-figure'
      }`}
    >
      <div className="pdf-inline-crop-stage">
        <canvas ref={canvasRef} className="pdf-inline-crop-canvas" />
      </div>
      {kind === 'figure' && crop.caption && (
        <figcaption className="pdf-inline-crop-caption">
          <span>{crop.caption}</span>
          {onOpenPdfPage && (
            <button
              type="button"
              className="btn-link-quiet"
              onClick={() => onOpenPdfPage(crop.pdfPage)}
              title={`Open PDF page ${crop.pdfPage}`}
            >
              PDF p. {crop.pdfPage}
            </button>
          )}
        </figcaption>
      )}
    </figure>
  );
};

interface PdfCanvasViewerProps {
  pdfSource: File | string | null;
  targetPdfPage: number;
  onPageChange?: (pdfPage: number) => void;
  onTextSelected?: (text: string, pdfPage: number) => void;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  pdfSource,
  targetPdfPage,
  onPageChange,
  onTextSelected,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(targetPdfPage || 152);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.35);
  const [pageTextItems, setPageTextItems] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (targetPdfPage && targetPdfPage !== currentPage) {
      setCurrentPage(targetPdfPage);
    }
  }, [targetPdfPage]);

  useEffect(() => {
    if (!pdfSource) {
      setPdfDoc(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const loadPdf = async () => {
      try {
        let loadingTask: pdfjsLib.PDFDocumentLoadingTask;
        if (typeof pdfSource === 'string') {
          loadingTask = pdfjsLib.getDocument(pdfSource);
        } else {
          const buf = await pdfSource.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data: buf });
        }
        const doc = await loadingTask.promise;
        if (!cancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            `Could not open PDF stream (${(err as Error).message}). Make sure the Python sidecar is running ("npm run sidecar") or use the "Open Local PDF" button in the top bar to select your Bolton PDF directly.`
          );
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [pdfSource]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let renderTask: pdfjsLib.RenderTask | null = null;
    let cancelled = false;

    const renderPage = async () => {
      try {
        const safePage = Math.max(1, Math.min(numPages || 1, currentPage));
        const page = await pdfDoc.getPage(safePage);
        if (cancelled || !canvasRef.current) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });
        await renderTask.promise;

        const textContent = await page.getTextContent();
        if (!cancelled) {
          const lines = textContent.items
            .map((item) => ('str' in item ? item.str : ''))
            .filter(Boolean);
          setPageTextItems(lines);
        }
      } catch {
        // Ignore render cancellation on fast page flip
      }
    };

    renderPage();
    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale, numPages]);

  const goPage = (next: number) => {
    const clamped = Math.max(1, Math.min(numPages || 737, next));
    setCurrentPage(clamped);
    onPageChange?.(clamped);
  };

  if (loading) {
    return (
      <div className="pdf-status-box">
        Loading PDF document with PDF.js...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="pdf-status-box pdf-status-warn">
        <p>{loadError}</p>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-container">
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-group">
          <button
            type="button"
            className="btn-quiet"
            onClick={() => goPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            ← Prev PDF Page
          </button>
          <span className="pdf-page-indicator">
            PDF Page <strong>{currentPage}</strong> / {numPages || '?'} (Book p.{' '}
            {Math.max(1, currentPage - 15)})
          </span>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => goPage(currentPage + 1)}
            disabled={numPages > 0 && currentPage >= numPages}
          >
            Next PDF Page →
          </button>
        </div>
        <div className="pdf-toolbar-group">
          <button
            type="button"
            className="btn-quiet"
            onClick={() => setScale((s) => Math.max(0.8, Number((s - 0.15).toFixed(2))))}
          >
            − Zoom
          </button>
          <span className="pdf-zoom-label">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => setScale((s) => Math.min(2.2, Number((s + 0.15).toFixed(2))))}
          >
            + Zoom
          </button>
        </div>
      </div>

      <div className="pdf-canvas-stage">
        <canvas ref={canvasRef} className="pdf-page-canvas" />
      </div>

      {pageTextItems.length > 0 && (
        <details className="pdf-text-layer-drawer">
          <summary>
            Selectable PDF.js Text Layer (Page {currentPage}) — select text to highlight
          </summary>
          <div
            className="pdf-selectable-text"
            onMouseUp={() => {
              const sel = window.getSelection()?.toString().trim();
              if (sel && sel.length > 3) {
                onTextSelected?.(sel, currentPage);
              }
            }}
          >
            {pageTextItems.join(' ')}
          </div>
        </details>
      )}
    </div>
  );
};
