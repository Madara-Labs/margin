// ============================================================================
// Book Ingestion Parser
// Extracts TOC, sections, paragraphs, equations (as LaTeX), tables, and
// worked numeric examples with source page & position anchors.
// ============================================================================

import {
  BookSection,
  BookStructure,
  EquationItem,
  ParagraphBlock,
  TableItem,
  TocEntry,
  WorkedExampleItem,
} from '../types/margin';

export interface RawIngestOptions {
  bookId: string;
  title: string;
  authors: string;
  license?: string;
  totalPages?: number;
}

const SECTION_HEADING_RE =
  /^(?:#{1,6}\s*)?(\d+\.\d+(?:\.\d+)*)\s+([A-Z0-9(“"'\[][^\n]{2,120})$/;
const CHAPTER_HEADING_RE = /^(?:#{1,6}\s*)?(?:Chapter\s+)?(\d+)\s+([A-Z][^\n]{2,90})$/;
const PAGE_MARKER_RE = /^===\s*(?:PDF\s+)?PAGE\s+(\d+)\s*===$/i;
const DISPLAY_EQ_RE = /^\$\$(.+?)\$\$(?:\s*\(([\d.]+|[A-Za-z]+)\))?$/;
const INLINE_MATH_HEAVY_RE =
  /(?:\\frac|\\implies|\bmax\b|\barg\s*max\b|subject\s+to|\bE\(|[a-zA-Z0-9_]+\s*=\s*[^,\n]{3,})/;
const RUNNING_HEADER_RE =
  /^(?:(\d{1,4})\s+([A-Z][A-Za-z0-9\s,'’“”\-&:;.()]{2,80})|[ivxlcdm]+\s+(?:Preface|Contents|Introduction)|(?:Preface|Contents|Introduction)\s+[ivxlcdm]+)$/i;

function isHeadingContinuationLine(
  currentTitle: string,
  nextLine: string,
  toc: TocEntry[],
  secNum: string
): boolean {
  if (!nextLine) return false;
  if (
    PAGE_MARKER_RE.test(nextLine) ||
    SECTION_HEADING_RE.test(nextLine) ||
    DISPLAY_EQ_RE.test(nextLine) ||
    nextLine.startsWith('|') ||
    /^\d+\.\d+/.test(nextLine)
  ) {
    return false;
  }

  const tocEntry = toc.find((t) => t.number === secNum);
  if (tocEntry) {
    const normToc = tocEntry.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normCurr = currentTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normNext = nextLine.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      normToc.length > normCurr.length &&
      normToc.startsWith(normCurr) &&
      normNext.length >= 3 &&
      normToc
        .slice(normCurr.length)
        .startsWith(normNext.slice(0, Math.min(10, normNext.length)))
    ) {
      return true;
    }
  }

  const endsWithConnector =
    /[,\-–—:]$|\b(?:and|or|of|in|to|for|with|under|without|between|from|by|on|as|at|into|over|through|versus|vs\.?|the|a|an)$/i.test(
      currentTitle.trim()
    );
  if (endsWithConnector && nextLine.length <= 72 && !/[.!?]$/.test(nextLine)) {
    return true;
  }

  return false;
}

export function parseDocumentStructure(
  rawText: string,
  options: RawIngestOptions
): BookStructure {
  const lines = rawText.split(/\r?\n/);

  const toc: TocEntry[] = [];
  const sections: BookSection[] = [];

  let currentPage = 1;
  let inContents = false;
  let justTurnedPage = false;
  let currentSection: BookSection | undefined = undefined;
  let currentChapterId = '1';
  let currentChapterTitle = '';

  const ensureSection = (
    num: string,
    title: string,
    page: number
  ): BookSection => {
    const ch = num.split('.')[0] || currentChapterId;
    currentChapterId = ch;
    const sec: BookSection = {
      id: num,
      chapterId: ch,
      number: num,
      title: title.trim(),
      startPage: page,
      endPage: page,
      paragraphs: [],
      equations: [],
      tables: [],
      workedExamples: [],
    };
    sections.push(sec);
    currentSection = sec;
    return sec;
  };

  let i = 0;
  let paragraphCounter = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line || line.startsWith('# ')) {
      i++;
      continue;
    }

    // Page boundary marker
    const pageMatch = line.match(PAGE_MARKER_RE);
    if (pageMatch) {
      currentPage = parseInt(pageMatch[1], 10);
      inContents = false;
      justTurnedPage = true;
      if (sections.length > 0) {
        const lastSec = sections[sections.length - 1];
        lastSec.endPage = Math.max(lastSec.endPage, currentPage);
      }
      i++;
      continue;
    }

    if (/^(?:[ivxlcdm]+\s+)?Contents(?:\s+[ivxlcdm]+)?$/i.test(line)) {
      inContents = true;
      justTurnedPage = false;
      i++;
      continue;
    }

    // Parse TOC entries when in Contents block (joining wrapped 2-line TOC entries)
    if (inContents) {
      let combinedTocLine = line;
      if (
        /^(\d+(?:\.\d+)*)\.?\s+[A-Z]/.test(combinedTocLine) &&
        !/\s+\d+$/.test(combinedTocLine) &&
        i + 1 < lines.length
      ) {
        const nextTrim = lines[i + 1].trim();
        if (
          nextTrim &&
          !/^(\d+(?:\.\d+)*)\s+/.test(nextTrim) &&
          /\s+\d+$/.test(nextTrim)
        ) {
          combinedTocLine = `${combinedTocLine} ${nextTrim}`;
          i++;
        }
      }
      const tocMatch = combinedTocLine.match(/^(\d+(?:\.\d+)*)\.?\s+(.+?)\s+(\d+)$/);
      if (tocMatch) {
        const [, num, title, pgStr] = tocMatch;
        const dots = num.split('.').length;
        const level: 1 | 2 | 3 = dots === 1 ? 1 : dots === 2 ? 2 : 3;
        toc.push({
          id: `toc-${num}`,
          number: num,
          title: title.trim(),
          level,
          page: parseInt(pgStr, 10),
        });
        i++;
        continue;
      }
    }

    // Top-of-page running header banner right after page marker (e.g. "5 Introduction" on page 5)
    if (justTurnedPage) {
      justTurnedPage = false;
      const runMatch = line.match(RUNNING_HEADER_RE);
      if (runMatch) {
        const hdrNum = runMatch[1] ? parseInt(runMatch[1], 10) : null;
        const hdrTitle = (runMatch[2] || '').trim();
        const isCurrentChapterRunningHeader =
          currentChapterTitle &&
          hdrTitle.toLowerCase() === currentChapterTitle.toLowerCase();
        const isMatchingChapterOpening =
          hdrNum !== null &&
          toc.some(
            (t) =>
              t.level === 1 &&
              t.number === String(hdrNum) &&
              t.title.toLowerCase() === hdrTitle.toLowerCase() &&
              t.number !== currentChapterId
          );
        if (!isMatchingChapterOpening || isCurrentChapterRunningHeader) {
          if (hdrNum !== null) {
            currentPage = hdrNum;
          }
          i++;
          continue;
        }
      }
    }

    // Chapter heading outside Contents
    const chapMatch = line.match(CHAPTER_HEADING_RE);
    if (chapMatch && !line.match(/\s+\d+$/)) {
      const [, chNum, chTitle] = chapMatch;
      // Avoid mistaking a running header "<pageNum> <ChapterTitle>" for a new chapter
      const isRunningHeader =
        currentSection &&
        currentChapterTitle &&
        chTitle.trim().toLowerCase() === currentChapterTitle.toLowerCase() &&
        chNum !== currentChapterId;
      if (isRunningHeader) {
        currentPage = parseInt(chNum, 10) || currentPage;
        i++;
        continue;
      }
      currentChapterId = chNum;
      currentChapterTitle = chTitle.trim();
      if (!toc.some((t) => t.number === chNum)) {
        toc.push({
          id: `toc-${chNum}`,
          number: chNum,
          title: chTitle.trim(),
          level: 1,
          page: currentPage,
        });
      }
      i++;
      continue;
    }

    // Section heading outside Contents (consuming wrapped continuation lines like "or Hidden Actions")
    const secMatch = line.match(SECTION_HEADING_RE);
    if (secMatch && !inContents && !/\s+\d{1,4}$/.test(line)) {
      const [, secNum, initialSecTitle] = secMatch;
      let fullSecTitle = initialSecTitle.trim();
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (isHeadingContinuationLine(fullSecTitle, nextLine, toc, secNum)) {
          fullSecTitle = /[a-zA-Z]-$/.test(fullSecTitle) && /^[a-z]/.test(nextLine)
            ? `${fullSecTitle.slice(0, -1)}${nextLine}`
            : `${fullSecTitle} ${nextLine}`;
          i++;
        } else {
          break;
        }
      }
      ensureSection(secNum, fullSecTitle, currentPage);
      const existingToc = toc.find((t) => t.number === secNum);
      if (!existingToc) {
        const dots = secNum.split('.').length;
        toc.push({
          id: `toc-${secNum}`,
          number: secNum,
          title: fullSecTitle.trim(),
          level: dots === 2 ? 2 : 3,
          page: currentPage,
        });
      } else if (fullSecTitle.length > existingToc.title.length) {
        existingToc.title = fullSecTitle;
      }
      i++;
      continue;
    }

    // Markdown Table block
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const sec =
          currentSection ||
          ensureSection(`${currentChapterId}.1`, 'Introduction', currentPage);
        const parsedTable = parseMarkdownTable(
          tableLines,
          sec.id,
          currentPage,
          sec.tables.length + 1
        );
        if (parsedTable) {
          sec.tables.push(parsedTable);
          paragraphCounter++;
          sec.paragraphs.push({
            id: `p-${sec.id}-${paragraphCounter}`,
            sectionId: sec.id,
            page: currentPage,
            index: paragraphCounter,
            text: parsedTable.caption,
            kind: 'table',
            tableData: parsedTable,
          });
        }
      }
      continue;
    }

    // Display equation block: $$...$$ (label)
    const eqMatch = line.match(DISPLAY_EQ_RE);
    if (eqMatch) {
      const sec =
        currentSection ||
        ensureSection(`${currentChapterId}.1`, 'Introduction', currentPage);
      const latex = eqMatch[1].trim();
      const label = eqMatch[2] ? `(${eqMatch[2]})` : undefined;
      const eqId = `eq-${sec.id}-${sec.equations.length + 1}`;
      const eqItem: EquationItem = {
        id: eqId,
        sectionId: sec.id,
        page: currentPage,
        latex,
        label,
        description: `Equation ${label || sec.equations.length + 1} in §${sec.id}`,
      };
      sec.equations.push(eqItem);
      paragraphCounter++;
      sec.paragraphs.push({
        id: `p-${sec.id}-${paragraphCounter}`,
        sectionId: sec.id,
        page: currentPage,
        index: paragraphCounter,
        text: line,
        kind: 'equation',
        latex,
        equationLabel: label,
      });
      i++;
      continue;
    }

    // Accumulate contiguous lines into a paragraph block
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const nextLine = lines[i].trim();
      if (
        !nextLine ||
        PAGE_MARKER_RE.test(nextLine) ||
        SECTION_HEADING_RE.test(nextLine) ||
        DISPLAY_EQ_RE.test(nextLine) ||
        nextLine.startsWith('|')
      ) {
        break;
      }
      paraLines.push(nextLine);
      i++;
    }

    const fullPara = paraLines.join(' ').trim();
    const sec =
      currentSection ||
      ensureSection(`${currentChapterId}.1`, 'Introduction', currentPage);
    sec.endPage = Math.max(sec.endPage, currentPage);

    paragraphCounter++;
    const paraId = `p-${sec.id}-${paragraphCounter}`;

    // Check if paragraph is a worked example
    if (/^(?:Worked\s+)?Example\b/i.test(fullPara)) {
      const we = parseWorkedExample(
        fullPara,
        sec.id,
        currentPage,
        sec.workedExamples.length + 1
      );
      sec.workedExamples.push(we);
      sec.paragraphs.push({
        id: paraId,
        sectionId: sec.id,
        page: currentPage,
        index: paragraphCounter,
        text: fullPara,
        kind: 'example',
      });
      continue;
    }

    // Check if paragraph contains an inline equation or derivation
    const isDerivation =
      /(?:Therefore|Substituting|Taking the first-order condition|This derivation yields|Solving this problem yields)/i.test(
        fullPara
      ) && INLINE_MATH_HEAVY_RE.test(fullPara);

    sec.paragraphs.push({
      id: paraId,
      sectionId: sec.id,
      page: currentPage,
      index: paragraphCounter,
      text: fullPara,
      kind: isDerivation ? 'derivation' : 'prose',
    });
  }

  return {
    bookId: options.bookId,
    title: options.title,
    authors: options.authors,
    license: options.license,
    totalPages: options.totalPages || currentPage,
    toc,
    sections,
  };
}

function parseMarkdownTable(
  lines: string[],
  sectionId: string,
  page: number,
  index: number
): TableItem | null {
  const cleanRow = (r: string) =>
    r
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());

  const headers = cleanRow(lines[0]);
  if (headers.every((h) => !h)) return null;

  const dataLines = lines.slice(1).filter((l) => !/^[\s|:-]+$/.test(l));
  const rows: (string | number)[][] = dataLines.map((l) =>
    cleanRow(l).map((cell) => {
      const num = Number(cell);
      return cell !== '' && !Number.isNaN(num) ? num : cell;
    })
  );

  return {
    id: `tbl-${sectionId}-${index}`,
    sectionId,
    page,
    caption: `Table ${sectionId}.${index} (Page ${page})`,
    headers,
    rows,
  };
}

function parseWorkedExample(
  text: string,
  sectionId: string,
  page: number,
  index: number
): WorkedExampleItem {
  const firstLineEnd = text.indexOf('\n');
  const titleMatch = text.match(/^(?:Worked\s+)?Example\s*[\d.]*:\s*([^.]+)/i);
  const title = titleMatch
    ? `Worked Example: ${titleMatch[1].trim()}`
    : firstLineEnd > 0
      ? text.slice(0, firstLineEnd)
      : `Worked Example ${sectionId}.${index}`;

  const parameters: Record<string, number> = {};
  const expectedOutputs: Record<string, number> = {};

  // Extract assignments like P = 4, F = 2, q^* = 4.0, \Pi^* = 6.0
  const assignRe = /([\\A-Za-z0-9_^*]+)\s*=\s*(-?\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = assignRe.exec(text)) !== null) {
    const rawKey = match[1].replace(/^\\/, '');
    const val = parseFloat(match[2]);
    if (
      rawKey.includes('*') ||
      /^(?:TR|TC|Pi|s_star|pi_sb|pi_fb)/i.test(rawKey)
    ) {
      expectedOutputs[rawKey] = val;
    } else {
      parameters[rawKey] = val;
    }
  }

  return {
    id: `ex-${sectionId}-${index}`,
    sectionId,
    page,
    title,
    parameters,
    expectedOutputs,
    notes: text,
  };
}
