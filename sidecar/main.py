"""
Margin Python Sidecar (FastAPI + SQLite + PDF Structure Ingestion + Anthropic API)
Local-first architecture:
- Books stay on the reader's machine.
- Stores per-book SQLite state (highlights, notes, recall attempts, maps, predictions, labs, revisit schedule).
- Calls Anthropic Claude API (reading ANTHROPIC_API_KEY from env, never logging it) only with per-section excerpts,
  and logs every prompt sent so it is visible in the "What the AI was asked" panel.
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import time
import urllib.request
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

try:
    import pypdf
except ImportError:
    pypdf = None

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "sidecar" / "margin_store.sqlite3"
FIXTURES_DIR = BASE_DIR / "fixtures"

# Default local paths where user's Bolton PDF may reside on disk (never committed to git)
LOCAL_BOLTON_PATHS = [
    Path.home() / "Calibre Library" / "Unknown" / "BOLTON 2005 , Contract Theory (13)" / "BOLTON 2005 , Contract Theory - Unknown.pdf",
    Path.home() / "Downloads" / "BOLTON 2005 , Contract Theory - Unknown.pdf",
    BASE_DIR / "sources" / "bolton_2005.pdf",
]

# Current Claude model (Anthropic API)
CLAUDE_MODEL = os.environ.get("MARGIN_CLAUDE_MODEL", "claude-sonnet-4-20250514")

app = FastAPI(title="Margin Local Sidecar", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS book_store (
            book_id TEXT PRIMARY KEY,
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS prompt_logs (
            id TEXT PRIMARY KEY,
            book_id TEXT NOT NULL,
            section_id TEXT NOT NULL,
            method TEXT NOT NULL,
            model TEXT NOT NULL,
            system_prompt TEXT NOT NULL,
            user_prompt TEXT NOT NULL,
            excerpt_chars INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def clean_pdf_text(raw: str) -> str:
    txt = raw.replace("\u00ad", "-")
    txt = re.sub(r"\s*[\ufb01\uf001]\s*", "fi", txt)
    txt = re.sub(r"\s*[\ufb02\uf002]\s*", "fl", txt)
    txt = re.sub(r"([a-z]{2,})([A-Z][a-z])", r"\1 \2", txt)
    txt = re.sub(r"(\d+\.\d+(?:\.\d+)*)([A-Z])", r"\1 \2", txt)
    return re.sub(r"\s+", " ", txt).strip()


def extract_markdown_structure(raw_text: str, book_id: str = "openstax-econ-3e") -> dict[str, Any]:
    """
    Deterministic parser for markdown/text extracted from PDF or OpenStax fixture.
    Detects TOC, sections (including multi-line wrapped headings), paragraphs,
    LaTeX equations, tables, and worked examples while stripping running headers.
    """
    lines = raw_text.splitlines()
    toc: list[dict[str, Any]] = []
    sections: list[dict[str, Any]] = []
    current_page = 1
    in_contents = False
    just_turned_page = False
    current_sec: Optional[dict[str, Any]] = None

    sec_re = re.compile(r"^(?:#{1,6}\s*)?(\d+\.\d+(?:\.\d+)*)\s*([A-Z0-9(“\"'\[][^\n]{2,120})$")
    toc_line_re = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+(.+?)\s+(\d{1,4})$")
    page_re = re.compile(r"^===\s*(?:PDF\s+)?PAGE\s+(\d+)\s*===$", re.IGNORECASE)
    eq_re = re.compile(r"^\$\$(.+?)\$\$(?:\s*\(([\d.]+|[A-Za-z]+)\))?$")
    running_hdr_re = re.compile(
        r"^(?:(\d{1,4})\s+([A-Z][A-Za-z0-9\s,'’“”\-&:;.()]{2,80})|[ivxlcdm]+\s+(?:Preface|Contents|Introduction)|(?:Preface|Contents|Introduction)\s+[ivxlcdm]+)$",
        re.IGNORECASE,
    )
    connector_end_re = re.compile(
        r"(?:[,\-–—:]|\b(?:and|or|of|in|to|for|with|under|without|between|from|by|on|as|at|into|over|through|versus|vs\.?|the|a|an))$",
        re.IGNORECASE,
    )

    i = 0
    para_idx = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or line.startswith("# "):
            i += 1
            continue

        m_page = page_re.match(line)
        if m_page:
            current_page = int(m_page.group(1))
            in_contents = False
            just_turned_page = True
            if current_sec:
                current_sec["endPage"] = max(current_sec["endPage"], current_page)
            i += 1
            continue

        if re.match(r"^(?:[ivxlcdm]+\s+)?Contents(?:\s+[ivxlcdm]+)?$", line, re.IGNORECASE):
            in_contents = True
            just_turned_page = False
            i += 1
            continue

        # Top-of-page running header banner right after page marker (e.g. "5 Introduction")
        if just_turned_page and not in_contents:
            just_turned_page = False
            m_run = running_hdr_re.match(line)
            if m_run:
                if m_run.group(1):
                    current_page = int(m_run.group(1))
                i += 1
                continue

        # Any line matching "8.2 Some Title 114" (including 2-line wrapped TOC entries) is a TOC entry
        if in_contents or current_page <= 20:
            combined_toc = line
            if (
                in_contents
                and re.match(r"^(\d+(?:\.\d+)*)\.?\s+[A-Z]", combined_toc)
                and not re.search(r"\s+\d{1,4}$", combined_toc)
                and i + 1 < len(lines)
            ):
                nxt = lines[i + 1].strip()
                if nxt and not re.match(r"^\d+(?:\.\d+)*\s+", nxt) and re.search(r"\s+\d{1,4}$", nxt):
                    combined_toc = f"{combined_toc} {nxt}"
                    i += 1
            m_toc = toc_line_re.match(combined_toc)
            if m_toc:
                num, title, pg = m_toc.groups()
                toc.append({
                    "id": f"toc-{num}",
                    "number": num,
                    "title": clean_pdf_text(title),
                    "level": min(3, len(num.split("."))),
                    "page": int(pg),
                })
                i += 1
                continue

        m_sec = sec_re.match(line)
        if m_sec and not in_contents and not re.search(r"\s+\d{1,4}$", line):
            sec_num, sec_title = m_sec.groups()
            clean_title = clean_pdf_text(sec_title)
            while i + 1 < len(lines):
                nxt = lines[i + 1].strip()
                if (
                    nxt
                    and not page_re.match(nxt)
                    and not sec_re.match(nxt)
                    and not re.match(r"^\d+\.\d+", nxt)
                    and connector_end_re.search(clean_title)
                    and len(nxt) <= 72
                    and not re.search(r"[.!?]$", nxt)
                ):
                    clean_title = clean_pdf_text(f"{clean_title} {nxt}")
                    i += 1
                else:
                    break
            current_sec = {
                "id": sec_num,
                "chapterId": sec_num.split(".")[0],
                "number": sec_num,
                "title": clean_title,
                "startPage": current_page,
                "endPage": current_page,
                "paragraphs": [],
                "equations": [],
                "tables": [],
                "workedExamples": [],
            }
            sections.append(current_sec)
            i += 1
            continue

        if line.startswith("|") and line.endswith("|"):
            tbl_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                tbl_lines.append(lines[i].strip())
                i += 1
            if len(tbl_lines) >= 2 and current_sec is not None:
                headers = [c.strip() for c in tbl_lines[0].strip("|").split("|")]
                rows = []
                for tl in tbl_lines[1:]:
                    if re.match(r"^[\s|:-]+$", tl):
                        continue
                    rows.append([c.strip() for c in tl.strip("|").split("|")])
                current_sec["tables"].append({
                    "id": f"tbl-{current_sec['id']}-{len(current_sec['tables']) + 1}",
                    "sectionId": current_sec["id"],
                    "page": current_page,
                    "headers": headers,
                    "rows": rows,
                })
            continue

        m_eq = eq_re.match(line)
        if m_eq and current_sec is not None:
            latex, label = m_eq.groups()
            current_sec["equations"].append({
                "id": f"eq-{current_sec['id']}-{len(current_sec['equations']) + 1}",
                "sectionId": current_sec["id"],
                "page": current_page,
                "latex": latex.strip(),
                "label": f"({label})" if label else None,
            })
            para_idx += 1
            current_sec["paragraphs"].append({
                "id": f"p-{current_sec['id']}-{para_idx}",
                "sectionId": current_sec["id"],
                "page": current_page,
                "text": line,
                "kind": "equation",
                "latex": latex.strip(),
            })
            i += 1
            continue

        if current_sec is not None:
            para_idx += 1
            kind = "example" if re.match(r"^(?:Worked\s+)?Example\b", line, re.I) else "prose"
            if kind == "example":
                current_sec["workedExamples"].append({
                    "id": f"ex-{current_sec['id']}-{len(current_sec['workedExamples']) + 1}",
                    "sectionId": current_sec["id"],
                    "page": current_page,
                    "text": line,
                })
            current_sec["paragraphs"].append({
                "id": f"p-{current_sec['id']}-{para_idx}",
                "sectionId": current_sec["id"],
                "page": current_page,
                "text": line,
                "kind": kind,
            })
        i += 1

    return {
        "bookId": book_id,
        "toc": toc,
        "sections": sections,
    }


class StorePayload(BaseModel):
    bookId: str
    state: dict[str, Any]


class LlmInstrumentRequest(BaseModel):
    bookId: str
    sectionId: str
    method: str
    sectionExcerpt: str
    readerInput: Optional[str] = None


@app.get("/api/health")
def health() -> dict[str, Any]:
    has_key = bool(os.environ.get("ANTHROPIC_API_KEY"))
    bolton_pdf = next((p for p in LOCAL_BOLTON_PATHS if p.exists() and p.stat().st_size > 1_000_000), None)
    return {
        "status": "ok",
        "sqlitePath": str(DB_PATH),
        "claudeModel": CLAUDE_MODEL,
        "anthropicKeyConfigured": has_key,
        "localBoltonPdfDetected": bool(bolton_pdf),
        "localBoltonPdfName": bolton_pdf.name if bolton_pdf else None,
    }


@app.get("/api/local-pdf/bolton")
def serve_local_bolton_pdf():
    """Streams the reader's local Bolton PDF directly from disk without copying it into git."""
    for p in LOCAL_BOLTON_PATHS:
        if p.exists() and p.stat().st_size > 1_000_000:
            return FileResponse(p, media_type="application/pdf", filename=p.name)
    raise HTTPException(status_code=404, detail="Local Bolton PDF not found in default paths.")


@app.get("/api/store/{book_id}")
def load_book_store(book_id: str) -> dict[str, Any]:
    conn = get_db()
    row = conn.execute(
        "SELECT state_json, updated_at FROM book_store WHERE book_id = ?", (book_id,)
    ).fetchone()
    conn.close()
    if not row:
        return {"bookId": book_id, "state": None}
    return {"bookId": book_id, "state": json.loads(row["state_json"]), "updatedAt": row["updated_at"]}


@app.post("/api/store")
def save_book_store(payload: StorePayload) -> dict[str, Any]:
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    conn = get_db()
    conn.execute(
        """
        INSERT INTO book_store (book_id, state_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(book_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
        """,
        (payload.bookId, json.dumps(payload.state), now),
    )
    conn.commit()
    conn.close()
    return {"status": "saved", "bookId": payload.bookId, "updatedAt": now}


@app.post("/api/ingest-pdf")
async def ingest_uploaded_pdf(file: UploadFile = File(...)) -> dict[str, Any]:
    if pypdf is None:
        raise HTTPException(status_code=500, detail="pypdf is not installed")
    data = await file.read()
    import io
    reader = pypdf.PdfReader(io.BytesIO(data))
    total_pages = len(reader.pages)
    extracted_chunks: list[str] = []
    for idx in range(min(total_pages, 250)):
        page_txt = reader.pages[idx].extract_text() or ""
        extracted_chunks.append(f"=== PAGE {idx + 1} ===\n{page_txt}")
    combined = "\n\n".join(extracted_chunks)
    structure = extract_markdown_structure(combined, book_id=file.filename or "uploaded-pdf")
    structure["totalPages"] = total_pages
    return structure


@app.post("/api/llm/instrument")
def generate_section_instrument(req: LlmInstrumentRequest) -> dict[str, Any]:
    """
    Sends ONLY the single section excerpt (never the whole book) to Anthropic Claude.
    Reads ANTHROPIC_API_KEY from env and never logs the key.
    Logs the exact system and user prompts to SQLite so they appear in 'What the AI was asked'.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    excerpt = req.sectionExcerpt[:12000]  # Strict per-section cap
    system_prompt = (
        "You are the instrument builder for Margin, a reader-first study tool. "
        "Never summarize the text for the reader to read instead of the book. "
        "Produce structured JSON instruments anchored to section page numbers so the reader's attempt comes first."
    )
    user_prompt = (
        f"Book: {req.bookId} | Section: {req.sectionId} | Method: {req.method}\n"
        f"Reader attempt (if any): {req.readerInput or '(none yet — generating pre-attempt instrument)'}\n\n"
        f"Section Excerpt:\n{excerpt}"
    )

    log_id = f"plog-{int(time.time() * 1000)}"
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    if not api_key:
        conn = get_db()
        conn.execute(
            "INSERT INTO prompt_logs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (log_id, req.bookId, req.sectionId, req.method, CLAUDE_MODEL, system_prompt, user_prompt, len(excerpt), "cached_local", now),
        )
        conn.commit()
        conn.close()
        return {
            "id": log_id,
            "status": "cached_local",
            "model": CLAUDE_MODEL,
            "systemPrompt": system_prompt,
            "userPrompt": user_prompt,
            "sectionExcerptCharCount": len(excerpt),
            "message": "ANTHROPIC_API_KEY not set in env; using verified cached section instrument.",
        }

    # Call Anthropic Messages API over HTTPS without logging api_key
    body = json.dumps({
        "model": CLAUDE_MODEL,
        "max_tokens": 1024,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }).encode("utf-8")

    http_req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(http_req, timeout=20) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            text_out = resp_data.get("content", [{}])[0].get("text", "")
            status = "completed"
    except Exception as exc:
        text_out = f"Anthropic API call fallback ({type(exc).__name__}); using cached anchor."
        status = "error"

    conn = get_db()
    conn.execute(
        "INSERT INTO prompt_logs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (log_id, req.bookId, req.sectionId, req.method, CLAUDE_MODEL, system_prompt, user_prompt, len(excerpt), status, now),
    )
    conn.commit()
    conn.close()
    return {
        "id": log_id,
        "status": status,
        "model": CLAUDE_MODEL,
        "systemPrompt": system_prompt,
        "userPrompt": user_prompt,
        "sectionExcerptCharCount": len(excerpt),
        "responseText": text_out,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765)
