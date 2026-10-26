import io
import json
from pathlib import Path
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sidecar.main import app, extract_markdown_structure

FIXTURE = Path(__file__).resolve().parent.parent.parent / "fixtures" / "openstax_economics_ch8.md"
client = TestClient(app)


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


def test_health_endpoint_reports_gemini_config():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "geminiModel" in data
    assert "geminiKeyConfigured" in data
    assert "claudeModel" in data
    assert "anthropicKeyConfigured" in data
    assert data["geminiModel"] == "gemini-2.5-flash"


def test_llm_instrument_gemini_without_key_falls_back():
    resp = client.post("/api/llm/instrument", json={
        "bookId": "bolton-test",
        "sectionId": "1.1",
        "method": "free_recall_check",
        "sectionExcerpt": "Sample excerpt text.",
        "provider": "gemini",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "cached_local"
    assert data["provider"] == "gemini"
    assert "gemini" in data["model"].lower()
    assert "Neither GEMINI_API_KEY nor ANTHROPIC_API_KEY" in data["message"]


def test_llm_instrument_gemini_with_mocked_api_call():
    mock_response = MagicMock()
    mock_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": '{"coverage": "covered", "explanation": "Accurate recall"}'}]
                }
            }
        ]
    }
    mock_response.read.return_value = json.dumps(mock_payload).encode("utf-8")
    mock_response.__enter__.return_value = mock_response

    with patch("urllib.request.urlopen", return_value=mock_response) as mock_urlopen:
        resp = client.post("/api/llm/instrument", json={
            "bookId": "bolton-test",
            "sectionId": "1.1",
            "method": "free_recall_check",
            "sectionExcerpt": "Sample excerpt text.",
            "provider": "gemini",
            "apiKey": "AIzaSyFakeGeminiKey12345",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert data["provider"] == "gemini"
        assert '{"coverage": "covered"' in data["responseText"]
        assert mock_urlopen.called
        req_arg = mock_urlopen.call_args[0][0]
        assert "generativelanguage.googleapis.com" in req_arg.full_url
        assert "key=AIzaSyFakeGeminiKey12345" in req_arg.full_url


