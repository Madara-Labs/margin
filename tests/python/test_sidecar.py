from pathlib import Path
from sidecar.main import extract_markdown_structure

FIXTURE = Path(__file__).resolve().parent.parent.parent / "fixtures" / "openstax_economics_ch8.md"


def test_python_ingestion_parser_on_openstax_fixture():
    raw = FIXTURE.read_text(encoding="utf-8")
    structure = extract_markdown_structure(raw, book_id="openstax-econ-3e")

    assert structure["bookId"] == "openstax-econ-3e"
    assert len(structure["toc"]) >= 6

    sec_ids = [s["id"] for s in structure["sections"]]
    assert sec_ids == ["7.1", "8.2", "8.3"]

    sec82 = next(s for s in structure["sections"] if s["id"] == "8.2")
    assert len(sec82["equations"]) == 3
    assert sec82["equations"][0]["label"] == "(8.1)"
    assert "TC(q)" in sec82["equations"][0]["latex"]

    assert len(sec82["tables"]) == 1
    assert len(sec82["tables"][0]["rows"]) == 6
    assert len(sec82["workedExamples"]) == 1


def test_python_parser_multiline_heading_and_running_header():
    raw = "\n".join([
        "=== PAGE 6 ===",
        "Contents",
        "1 Introduction 1",
        "1.1 Optimal Employment Contracts without Uncertainty, Hidden",
        "Information, or Hidden Actions 4",
        "=== PAGE 21 ===",
        "4 Introduction",
        "1.1 Optimal Employment Contracts without Uncertainty, Hidden Information,",
        "or Hidden Actions",
        "Consider the following standard bilateral contracting problem.",
        "=== PAGE 22 ===",
        "5 Introduction",
        "Both individuals could decide not to trade.",
    ])
    structure = extract_markdown_structure(raw, book_id="bolton-test")
    sec11 = next(s for s in structure["sections"] if s["id"] == "1.1")
    assert sec11["title"] == "Optimal Employment Contracts without Uncertainty, Hidden Information, or Hidden Actions"
    assert sec11["paragraphs"][0]["text"] == "Consider the following standard bilateral contracting problem."
    assert "or Hidden Actions" not in sec11["paragraphs"][0]["text"]
    assert sec11["paragraphs"][1]["text"] == "Both individuals could decide not to trade."
    assert "5 Introduction" not in sec11["paragraphs"][1]["text"]
    assert sec11["paragraphs"][1]["page"] == 5

