from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def test_project_identity_constants_are_current():
    version_py = read_text("pf_rag/version.py")

    assert 'APP_NAME = "pathfinder_tools"' in version_py
    assert 'APP_VERSION = "1.2.2"' in version_py
    assert 'APP_RELEASE_NAME = f"{APP_NAME}_v{APP_VERSION}"' in version_py


def test_user_facing_project_name_uses_pathfinder_tools():
    files = [
        "README.md",
        "run_lite.py",
        "run_web.py",
        "web/index.html",
        "web/status_tracker.html",
        "scripts/package/package_lite.py",
        "scripts/package/package_portable.py",
    ]
    combined = "\n".join(read_text(path) for path in files)

    assert "pathfinder_tools_v1.2.2" in combined
    assert "PFSpellRAG v1.2.1" not in combined
    assert "PF Searcher Lite" not in combined
    assert "PF Spell RAG" not in combined
    assert "PFSearcher_v1.2.1" not in combined
