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


def test_basic_stats_use_overview_cards_and_detail_sidebar():
    script = read_text("web/assets/js/status-tracker.js")
    style = read_text("web/assets/css/status-tracker.css")

    expected_script_markers = [
        "STATUS_DETAIL_CONFIGS",
        "activeDetailId = null",
        "renderBasicOverview",
        "renderDetailSidebar",
        "renderOverviewCard",
        "data-detail-id",
        "data-action=\"select-detail\"",
        "data-action=\"close-detail\"",
        "detail-drawer",
        "detail-overlay",
        "calculateAbilityScore",
        "calculateArmorClass",
        "calculateSaveTotal",
    ]
    for marker in expected_script_markers:
        assert marker in script

    expected_detail_ids = [
        "ability-str",
        "ability-dex",
        "hp",
        "ac",
        "save-fort",
        "save-ref",
        "save-will",
        "attack-melee",
        "attack-ranged",
        "attack-cmb",
        "attack-cmd",
        "initiative",
        "speed-land",
    ]
    for detail_id in expected_detail_ids:
        assert detail_id in script

    expected_style_markers = [
        ".status-overview-grid",
        ".overview-card",
        ".detail-sidebar",
        ".detail-sidebar.is-open",
        ".detail-drawer",
        ".detail-overlay",
        ".detail-close-btn",
        ".detail-breakdown",
        ".detail-row",
    ]
    for marker in expected_style_markers:
        assert marker in style


def test_detail_sidebar_uses_modifier_sources_without_notes():
    script = read_text("web/assets/js/status-tracker.js")
    style = read_text("web/assets/css/status-tracker.css")

    expected_script_markers = [
        "detailModifiers",
        "renderModifierRows",
        "modifier-value",
        "modifier-source",
        "add-detail-modifier",
        "remove-detail-modifier",
        "setModifierField",
        "sumDetailModifiers",
        "hpMaxBase",
        "current HP",
        "temporary HP",
        "nonlethal damage",
    ]
    for marker in expected_script_markers:
        assert marker in script

    detail_config = script.split("const STATUS_DETAIL_CONFIGS", 1)[1].split("function toNumber", 1)[0]
    assert "noteField(" not in detail_config
    assert "notes" not in detail_config

    expected_style_markers = [
        ".modifier-table",
        ".modifier-row",
        ".modifier-value",
        ".modifier-source",
        ".modifier-remove-btn",
    ]
    for marker in expected_style_markers:
        assert marker in style

def test_detail_modifier_actions_are_wired_to_click_handler():
    script = read_text("web/assets/js/status-tracker.js")
    click_handler = script.split('document.addEventListener("click"', 1)[1]

    assert 'if (action === "add-detail-modifier")' in click_handler
    assert 'addDetailModifier(actionTarget.dataset.detailId)' in click_handler
    assert 'if (action === "remove-detail-modifier")' in click_handler
    assert 'removeDetailModifier(actionTarget.dataset.detailId, actionTarget.dataset.modifierId)' in click_handler

def test_detail_modifier_rows_include_value_type_and_wider_drawer():
    script = read_text("web/assets/js/status-tracker.js")
    style = read_text("web/assets/css/status-tracker.css")

    expected_script_markers = [
        'type: ""',
        'data-modifier-field="type"',
        'modifier-type',
        '数值类型',
        '["value", "type", "source"]',
    ]
    for marker in expected_script_markers:
        assert marker in script

    expected_style_markers = [
        'width: min(520px, 96vw)',
        'grid-template-columns: 92px 120px minmax(0, 1fr) 68px',
        '.modifier-type',
    ]
    for marker in expected_style_markers:
        assert marker in style

def test_status_tracker_has_attack_profiles_section():
    script = read_text("web/assets/js/status-tracker.js")
    style = read_text("web/assets/css/status-tracker.css")

    expected_script_markers = [
        '"attackProfiles"',
        "攻击方式",
        "renderAttackProfiles",
        "addAttackProfile",
        "duplicateAttackProfile",
        "removeAttackProfile",
        "addAttackLine",
        "removeAttackLine",
        "add-attack-profile",
        "duplicate-attack-profile",
        "remove-attack-profile",
        "add-attack-line",
        "remove-attack-line",
        "attackBonus",
        "damageType",
        "reachOrRange",
    ]
    for marker in expected_script_markers:
        assert marker in script

    expected_style_markers = [
        ".attack-profile-card",
        ".attack-lines-table",
        ".attack-line-row",
    ]
    for marker in expected_style_markers:
        assert marker in style

def test_status_tracker_section_config_keeps_attacks_classes_and_spells_separate():
    script = read_text("web/assets/js/status-tracker.js")

    assert '["attacks", "攻击方式"' in script
    assert '["classFeatures", "职业能力"' in script
    assert '["spells", "法术"' in script
    assert '职业能力", "记录职业、等级，以及每一等级对应的职业能力。"],' in script

def test_status_tracker_can_clear_section_or_current_profile_with_confirmation():
    page = read_text("web/status_tracker.html")
    script = read_text("web/assets/js/status-tracker.js")

    expected_page_markers = [
        'data-action="clear-current-section"',
        'data-action="clear-current-profile"',
    ]
    for marker in expected_page_markers:
        assert marker in page

    expected_script_markers = [
        "clearCurrentSection",
        "clearCurrentProfile",
        "resetSection",
        "clear-current-section",
        "clear-current-profile",
        "window.confirm",
        "characterName",
    ]
    for marker in expected_script_markers:
        assert marker in script

def test_status_tracker_supports_entry_modifiers_as_automatic_basic_sources():
    script = read_text("web/assets/js/status-tracker.js")
    style = read_text("web/assets/css/status-tracker.css")

    expected_script_markers = [
        "modifierTargets",
        "modifierTypesByTarget",
        "stackMode",
        "collectAutomaticModifiers",
        "calculateStackedModifierTotal",
        "function sumAutomaticModifiers",
        "getAutomaticModifiersForDetail",
        "renderAutomaticModifierRows",
        "renderAutomaticModifierRows(activeDetailId)",
        "renderEntryModifierDrawer",
        "open-entry-editor",
        "close-entry-editor",
        "add-entry-modifier",
        "remove-entry-modifier",
        "setEntryModifierField",
        'data-modifier-target',
        'data-action="open-entry-editor"',
        'data-action="add-entry-modifier"',
        'data-action="remove-entry-modifier"',
        'data-entry-modifier-field="enabled"',
        'data-entry-modifier-field="stackMode"',
    ]
    for marker in expected_script_markers:
        assert marker in script

    expected_targets = [
        '"ac"',
        '"save-fort"',
        '"ability-str"',
        '"attack-melee"',
        '"speed-land"',
    ]
    for marker in expected_targets:
        assert marker in script

    expected_style_markers = [
        ".entry-modifier-drawer",
        ".entry-modifier-row",
        ".automatic-modifier-table",
        ".automatic-modifier-row",
        ".entry-modifier-actions",
    ]
    for marker in expected_style_markers:
        assert marker in style

def test_status_tracker_lists_use_summary_cards_and_editor_drawer():
    script = read_text("web/assets/js/status-tracker.js")
    style = read_text("web/assets/css/status-tracker.css")

    expected_script_markers = [
        "renderEntrySummary",
        "renderEntryEditorDrawer",
        "renderEntryModifierSummary",
        "open-entry-editor",
        "close-entry-editor",
        'data-action="open-entry-editor"',
        'data-action="close-entry-editor"',
        "entry-summary-card",
        "entry-summary-effect",
        "entry-summary-modifiers",
        "entry-editor-drawer",
        "普通字段",
        "数值影响",
    ]
    for marker in expected_script_markers:
        assert marker in script

    expected_style_markers = [
        ".entry-summary-card",
        ".entry-summary-meta",
        ".entry-summary-effect",
        ".entry-summary-modifiers",
        ".entry-editor-drawer",
    ]
    for marker in expected_style_markers:
        assert marker in style

def test_status_tracker_uses_temporary_session_with_manual_browser_save():
    page = read_text("web/status_tracker.html")
    script = read_text("web/assets/js/status-tracker.js")

    expected_page_markers = [
        'data-action="save-to-browser"',
        'data-action="load-from-browser"',
        'data-action="clear-browser-save"',
    ]
    for marker in expected_page_markers:
        assert marker in page

    expected_script_markers = [
        "saveProfilesToBrowser",
        "loadProfilesFromBrowser",
        "clearBrowserSave",
        "markProfilesDirty",
        "function activeProfile",
        "临时状态",
        "有未保存改动",
        "已保存到浏览器",
        'action === "save-to-browser"',
        'action === "load-from-browser"',
        'action === "clear-browser-save"',
    ]
    for marker in expected_script_markers:
        assert marker in script

    load_profiles_block = script.split("function loadProfiles()", 1)[1].split("function loadActiveProfileId", 1)[0]
    assert "localStorage.getItem" not in load_profiles_block
    assert "return [defaultProfile()]" in load_profiles_block

    save_profiles_block = script.split("function saveProfiles()", 1)[1].split("function saveProfilesToBrowser", 1)[0]
    assert "localStorage.setItem" not in save_profiles_block
