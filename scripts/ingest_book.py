#!/usr/bin/env python3
"""
CLI Ingestion Utility for Margin
Ingests any local PDF (or Markdown/text file) into the local SQLite database
(`sidecar/margin_store.sqlite3`) and writes a structured JSON index to
`sources/<book-id>.structure.json`.

Usage:
  python3 scripts/ingest_book.py "/path/to/any-book.pdf" --max-pages 100
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from sidecar.main import extract_markdown_structure, get_db

try:
    import pypdf
except ImportError:
    pypdf = None


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def ingest_file(file_path: Path, max_pages: int = 150) -> dict:
    book_id = slugify(file_path.stem)
    if file_path.suffix.lower() == ".pdf":
        if pypdf is None:
            raise RuntimeError("pypdf is required to ingest PDF files.")
        reader = pypdf.PdfReader(str(file_path))
        total_pages = len(reader.pages)
        chunks: list[str] = []
        limit = min(total_pages, max_pages)
        print(f"Extracting text from '{file_path.name}' ({limit}/{total_pages} pages)...")
        for idx in range(limit):
            txt = reader.pages[idx].extract_text() or ""
            chunks.append(f"=== PAGE {idx + 1} ===\n{txt}")
        raw_text = "\n\n".join(chunks)
    else:
        raw_text = file_path.read_text(encoding="utf-8")
        total_pages = raw_text.count("=== PAGE") or 1

    structure = extract_markdown_structure(raw_text, book_id=book_id)
    structure["title"] = file_path.stem
    structure["totalPages"] = total_pages
    structure["pdfFilename"] = file_path.name

    out_dir = Path(__file__).resolve().parent.parent / "sources"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{book_id}.structure.json"
    out_file.write_text(json.dumps(structure, indent=2), encoding="utf-8")

    # Also register initial book store in SQLite
    conn = get_db()
    conn.execute(
        """
        INSERT OR IGNORE INTO book_store (book_id, state_json, updated_at)
        VALUES (?, ?, datetime('now'))
        """,
        (book_id, json.dumps({"bookId": book_id, "structureSummary": {"sections": len(structure["sections"]), "totalPages": total_pages}})),
    )
    conn.commit()
    conn.close()

    print(f"✓ Ingested '{file_path.name}' -> bookId='{book_id}'")
    print(f"  • TOC entries: {len(structure['toc'])}")
    print(f"  • Sections:    {len(structure['sections'])}")
    print(f"  • Saved index: {out_file}")
    return structure


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest any local PDF or Markdown book into Margin.")
    parser.add_argument("path", type=str, help="Path to the PDF or Markdown file")
    parser.add_argument("--max-pages", type=int, default=150, help="Maximum PDF pages to parse in one pass")
    args = parser.parse_args()
    ingest_file(Path(args.path).expanduser().resolve(), max_pages=args.max_pages)
