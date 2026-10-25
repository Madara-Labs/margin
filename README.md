# Margin — A Reader-First Study Tool That Makes the Human Do the Learning

> **Core Design Principle:** The book stays in the middle. The software adds quiet margin prompts and between-section instruments that make the reader do the thinking—and AI-generated content appears **only after the reader's own attempt, as a comparison**. There is no chat-with-your-PDF box as the main interface, and summaries are never auto-shown on open.

---

## Quick Start & Setup

### Prerequisites
- **Node.js** (v18+ / v20+) and **npm**
- **Python 3.11+** (with `fastapi`, `uvicorn`, `pypdf`, and `pytest` for the local SQLite & PDF ingestion sidecar)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure the Anthropic API Key (Optional for Cached Sections)

Margin uses the Anthropic Messages API with a current Claude model (`claude-sonnet-4-20250514` by default, configurable via `MARGIN_CLAUDE_MODEL`). Set your API key in the environment before starting the sidecar:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

- **Privacy & Security Rules:**
  - `ANTHROPIC_API_KEY` is read exclusively from `os.environ` in `sidecar/main.py` and is **never logged or written to disk**.
  - Only the active section excerpt (capped to the section text) is sent to the LLM—never the whole book at once.
  - Every prompt sent to the LLM is recorded in SQLite and visible in the **"What the AI Was Asked"** transparency drawer in the top bar.

### 3. Start the App (Frontend + Local Python Sidecar)

```bash
# Run both the Vite frontend (http://localhost:5173) and FastAPI/SQLite sidecar (http://127.0.0.1:8765):
npm start

# Or run them separately:
npm run dev       # Vite React/TS reader UI on http://localhost:5173
npm run sidecar   # Python FastAPI + SQLite sidecar on http://127.0.0.1:8765
```

---

## Ingesting Any Local PDF:
   - Click **`Open PDF…`** in the top reader bar to select any PDF on your computer, or POST to `POST /api/ingest-pdf` on the local sidecar.
   - The ingestion pipeline extracts the Table of Contents, section boundaries, paragraphs, LaTeX equations (`EquationItem`), tables (`TableItem`), and worked numeric examples (`WorkedExampleItem`), storing per-book state in `localStorage` and `sidecar/margin_store.sqlite3`.

---

## Running the Bolton §4.2 Demo Walkthrough & Tests

```bash
# Run both TypeScript (Vitest) and Python (pytest) test suites:
npm run test:all
```

### What the Tests Verify
1. **Ingestion Parser (`tests/margin.test.ts` & `tests/python/test_sidecar.py`):** Verifies TOC, section boundary, LaTeX equation, table, and worked-example extraction on the CC-BY OpenStax *Principles of Economics* fixture.
2. **Explorable Model Verification (`src/lib/labVerifier.ts`):**
   - Evaluates formulas safely via `math.js` (never `eval`).
   - Runs an independent 2,000-point numerical grid optimization certificate check.
   - Confirms that a deliberately wrong formula fails verification and blocks the lab UI with `"Couldn't verify this model"` and the exact error reason.
3. **Spaced Revisit Scheduler (`src/lib/revisitScheduler.ts`):** Verifies the `1, 3, 7, 21` day progression and cross-chapter section interleaving.

---

## Keyboard Shortcuts

- `/` — Focus search across equations and section text
- `b` — Toggle Table of Contents sidebar
- `d` — Toggle Light / Dark reader theme
- `h` — Highlight currently selected text, or toggle the **Highlight Tool** on/off (selecting text always auto-copies to clipboard)
- `[` / `]` — Previous / Next section in Reader Text View

---

## Copyright & Privacy Architecture

- **Books stay on your machine:** Copyrighted PDFs are ignored via `.gitignore` and never committed.
- **Reader-only Exports:** Clicking **`Export My Work`** exports Markdown + JSON containing **only** what you authored (pre-question guesses, free-recall attempts, concept maps, slider predictions, margin notes, and highlight page anchors)—never the book's text.
- See [`docs/learning-design.md`](docs/learning-design.md) for the full research mapping citing Dunlosky et al. (2013), Karpicke & Blunt (2011), Fiorella & Mayer (2015), and Sinha & Kapur (2021).
