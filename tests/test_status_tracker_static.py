from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def test_status_tracker_is_registered_in_main_shell():
    index_html = read_text("web/index.html")
    index_js = read_text("web/assets/js/index.js")

    assert 'data-tab="statusTracker"' in index_html
    assert 'id="pane-status-tracker"' in index_html
    assert 'src="status_tracker.html' in index_html
    assert "statusTracker" in index_js
    assert 'document.getElementById("pane-status-tracker")' in index_js


def test_status_tracker_page_and_assets_cover_all_editable_sections():
    page = read_text("web/status_tracker.html")
    script = read_text("web/assets/js/status-tracker.js")
    style = read_text("web/assets/css/status-tracker.css")

    assert "assets/css/status-tracker.css" in page
    assert "assets/js/status-tracker.js" in page
    assert "pf_status_tracker_profiles_v1" in script
    assert "pf_status_tracker_active_profile_v1" in script

    expected_sections = [
        "基础数值",
        "职业能力",
        "法术",
        "当前专长",
        "当前 Buff",
        "其他生物",
        "奇物",
        "剧情备注",
    ]
    for section in expected_sections:
        assert section in page or section in script

    expected_fields = [
        "最大 HP",
        "当前 HP",
        "AC",
        "强韧",
        "BAB",
        "CMB",
        "CMD",
        "先攻",
        "法术位",
        "法术 DC",
        "持续时间",
        "召唤物",
        "当前任务",
    ]
    for field in expected_fields:
        assert field in script

    assert ".tracker-shell" in style
