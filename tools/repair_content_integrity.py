#!/usr/bin/env python3
"""Repair spell profession aliases and feat text contamination.

Designed for the pf_searcher_v1.0 repository (with-Conditions layout).

What it does
------------
1. Normalizes approved spell profession aliases in every spell JSON under result/.
2. Deduplicates identical profession-level pairs after normalization.
3. Patches both spell filter JavaScript alias tables so future data is normalized at runtime.
4. Repairs feat records in result/feats/feats-frontend.json where one feat field contains
   the beginning of later feat records.
5. Writes a detailed audit report and creates backups before modifying files.

Run from repository root:
    python tools/repair_content_integrity.py --apply

Use --dry-run to inspect proposed changes without writing files.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import re
import shutil
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable


# User-approved canonicalization map. All Unchained summoner variants are intentionally
# merged into the ordinary Summoner bucket, per the user's final decision.
PROFESSION_ALIASES: dict[str, str] = {
    # Mesmerist
    "催眠师": "催眠师",
    "惟眠师": "催眠师",
    "mesmerist": "催眠师",
    "慛眠师": "催眠师",

    # Summoner, including Unchained variants (explicitly approved to merge)
    "召唤师": "召唤师",
    "召唤旒": "召唤师",
    "召唤师 u": "召唤师",
    "召唤师 unchained": "召唤师",
    "summoner": "召唤师",
    "summoner u": "召唤师",
    "summoner unchained": "召唤师",
    "summoner (unchained)": "召唤师",
    "召唤施": "召唤师",

    # Wizard
    "法师": "法师",
    "法术": "法师",
    "巫师": "法师",
    "wizard": "法师",

    # Magus
    "魔战士": "魔战士",
    "魔战": "魔战士",
    "magus": "魔战士",

    # Alchemist
    "炼金术师": "炼金术师",
    "炼金术士": "炼金术师",
    "练金术师": "炼金术师",
    "炼金师": "炼金术师",
    "alchemist": "炼金术师",

    # Bloodrager
    "血脉狂怒者": "血脉狂怒者",
    "血脉狂暴者": "血脉狂怒者",
    "血脉暴怒者": "血脉狂怒者",
    "bloodrager": "血脉狂怒者",

    # Bard, including 诗人 (explicitly approved)
    "吟游诗人": "吟游诗人",
    "吟游吟游诗人": "吟游诗人",
    "吟游诗人诗人": "吟游诗人",
    "吟游诗人诗": "吟游诗人",
    "吟游诗": "吟游诗人",
    "游吟诗人": "吟游诗人",
    "诗人": "吟游诗人",
    "bard": "吟游诗人",

    # Occultist
    "秘学士": "秘学士",
    "密学士": "秘学士",
    "occultist": "秘学士",

    # Psychic
    "异能者": "异能者",
    "异能师": "异能者",
    "psychic": "异能者",

    # Warpriest
    "战斗祭司": "战斗祭司",
    "战争祭司": "战斗祭司",
    "warpriest": "战斗祭司",
}

# Existing valid aliases retained by the project.
EXTRA_EXISTING_ALIASES: dict[str, str] = {
    "炼金术士": "炼金术师",
    "调查者": "调查员",
    "反圣武士": "反圣骑士",
    "奥能者": "奥能师",
    "唤魂者": "唤魂师",
    "唤灵师": "唤魂师",
    "唤师师": "唤魂师",
    "圣武士": "圣骑士",
}

ALL_ALIASES = {**EXTRA_EXISTING_ALIASES, **PROFESSION_ALIASES}

# Keep case-insensitive matching for English forms while preserving exact Chinese matching.
def alias_key(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).casefold()

ALIAS_BY_KEY = {alias_key(k): v for k, v in ALL_ALIASES.items()}

LEVEL_TEXT_KEYS = ("等级", "等級", "level_raw")
STRUCTURED_LEVEL_KEYS = ("class_levels", "level_by_class")
CLASS_NAME_KEYS = ("class", "profession", "职业")
LEVEL_NUMBER_KEYS = ("level", "环位")

FEAT_TEXT_FIELDS = (
    "prerequisites",
    "benefit_summary",
    "detail_text",
    "flavor_text",
    "story_prerequisites",
    "immediate_benefit",
    "story_goal",
    "completion_benefit",
)

SOURCE_CODES = (
    "CRB", "APG", "ACG", "ARG", "UC", "UM", "UI", "OA", "AARCH",
    "COTR", "FOB", "FOC", "FOP", "ISG", "ISI", "ISM", "ISWG", "MTT",
    "RTT", "TG", "AG", "MC", "MA", "VC", "HA", "UW", "PA", "BOTD",
)


@dataclass
class SpellChange:
    file: str
    spell: str
    field: str
    before: str
    after: str


@dataclass
class FeatChange:
    feat_id: str
    name: str
    field: str
    before_length: int
    after_length: int
    reason: str
    removed_preview: str


@dataclass
class JsPatchChange:
    file: str
    changed: bool


def clean_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def canonicalize_profession(value: str) -> str:
    cleaned = clean_spaces(value)
    if not cleaned:
        return ""
    return ALIAS_BY_KEY.get(alias_key(cleaned), cleaned)


def normalize_profession_group(value: str) -> str:
    """Normalize slash-separated class names without touching level numbers."""
    pieces = re.split(r"\s*[／/]\s*", clean_spaces(value))
    output: list[str] = []
    seen: set[str] = set()
    for piece in pieces:
        canonical = canonicalize_profession(piece)
        if canonical and canonical not in seen:
            output.append(canonical)
            seen.add(canonical)
    return "/".join(output)


# Match a profession group followed by a single spell level. The profession portion is
# intentionally limited to one comma/semicolon-delimited segment.
LEVEL_ENTRY_RE = re.compile(
    r"(?P<prefix>^|[，,、；;])(?P<space>\s*)"
    r"(?P<classes>[^，,、；;0-9]{1,80}?)\s*"
    r"(?P<level>[0-9])(?P<tail>(?=\s*(?:$|[，,、；;])))",
    re.IGNORECASE,
)


def normalize_level_text(value: str) -> str:
    text = str(value or "")
    if not text.strip():
        return text

    def replace_match(match: re.Match[str]) -> str:
        raw_classes = match.group("classes").strip()
        canonical = normalize_profession_group(raw_classes)
        if not canonical:
            canonical = raw_classes
        return f"{match.group('prefix')}{match.group('space')}{canonical} {match.group('level')}"

    replaced = LEVEL_ENTRY_RE.sub(replace_match, text)

    # Deduplicate identical complete comma-separated entries after normalization.
    pieces = re.split(r"([，,、；;])", replaced)
    output: list[str] = []
    seen_entries: set[str] = set()
    pending_separator = ""
    for i, piece in enumerate(pieces):
        if i % 2 == 1:
            pending_separator = piece
            continue
        token = piece.strip()
        if not token:
            continue
        parsed = re.fullmatch(r"(.+?)\s*([0-9])", token)
        key = None
        if parsed:
            key = f"{normalize_profession_group(parsed.group(1))}\0{parsed.group(2)}"
        if key and key in seen_entries:
            continue
        if key:
            seen_entries.add(key)
        if output:
            output.append(pending_separator or "，")
        output.append(token)
        pending_separator = ""
    return "".join(output) if output else replaced


def spell_display_name(record: dict[str, Any]) -> str:
    for key in ("name_zh", "名称", "中文名", "译名", "name"):
        value = record.get(key)
        if value:
            return clean_spaces(str(value))
    return "(未命名法术)"


def looks_like_spell_record(record: dict[str, Any]) -> bool:
    return bool(
        any(key in record for key in LEVEL_TEXT_KEYS + STRUCTURED_LEVEL_KEYS)
        and any(key in record for key in ("name", "name_zh", "名称", "中文名", "译名"))
    )


def repair_spell_record(record: dict[str, Any], file_label: str, changes: list[SpellChange]) -> None:
    name = spell_display_name(record)

    for key in LEVEL_TEXT_KEYS:
        value = record.get(key)
        if not isinstance(value, str) or not value.strip():
            continue
        normalized = normalize_level_text(value)
        if normalized != value:
            changes.append(SpellChange(file_label, name, key, value, normalized))
            record[key] = normalized

    for array_key in STRUCTURED_LEVEL_KEYS:
        items = record.get(array_key)
        if not isinstance(items, list):
            continue
        seen: set[tuple[str, int | str]] = set()
        repaired: list[Any] = []
        changed = False
        for item in items:
            if not isinstance(item, dict):
                repaired.append(item)
                continue
            new_item = copy.deepcopy(item)
            class_key = next((k for k in CLASS_NAME_KEYS if k in new_item), None)
            level_key = next((k for k in LEVEL_NUMBER_KEYS if k in new_item), None)
            if class_key and isinstance(new_item.get(class_key), str):
                before_class = new_item[class_key]
                after_class = normalize_profession_group(before_class)
                if after_class != before_class:
                    changes.append(SpellChange(file_label, name, f"{array_key}.{class_key}", before_class, after_class))
                    new_item[class_key] = after_class
                    changed = True
            if class_key and level_key:
                pair = (str(new_item.get(class_key)), new_item.get(level_key))
                if pair in seen:
                    changed = True
                    continue
                seen.add(pair)
            repaired.append(new_item)
        if changed:
            record[array_key] = repaired


def walk_json(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_json(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_json(child)


def find_spell_files(root: Path) -> list[Path]:
    result_root = root / "result"
    if not result_root.exists():
        return []
    files: list[Path] = []
    for path in result_root.rglob("*.json"):
        lower = path.name.casefold()
        if "spell" in lower:
            files.append(path)
    return sorted(files)


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def feat_identity(record: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        str(record.get("feat_id") or record.get("match_key") or ""),
        clean_spaces(record.get("name_cn") or ""),
        clean_spaces(record.get("name_en") or ""),
        clean_spaces(record.get("name_raw") or ""),
    )


def looks_like_feat_record(record: dict[str, Any]) -> bool:
    return bool(
        (record.get("feat_id") or record.get("match_key"))
        and (record.get("name_cn") or record.get("name_en") or record.get("name_raw"))
        and any(field in record for field in FEAT_TEXT_FIELDS)
    )


def collect_unique_feat_records(data: Any) -> list[dict[str, Any]]:
    seen_objects: set[int] = set()
    records: list[dict[str, Any]] = []
    for record in walk_json(data):
        if id(record) in seen_objects or not looks_like_feat_record(record):
            continue
        seen_objects.add(id(record))
        records.append(record)
    return records


def normalize_for_search(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).casefold()


def find_flexible_pair(text: str, cn: str, en: str, start: int = 0) -> int:
    """Find a strong feat heading marker: Chinese title followed by its English title.

    This is intentionally stricter than merely seeing another feat name, because feat rules
    often refer to other feats. A bilingual title pair is a much stronger indication that
    a later source record was accidentally concatenated.
    """
    if not cn or not en:
        return -1
    lower = text.casefold()
    en_lower = en.casefold()
    pos = text.find(cn, start)
    while pos >= 0:
        window_end = min(len(text), pos + len(cn) + 140)
        en_pos = lower.find(en_lower, pos + len(cn), window_end)
        if en_pos >= 0:
            return pos
        pos = text.find(cn, pos + 1)
    return -1


def find_other_feat_boundary(
    text: str,
    current: dict[str, Any],
    feat_catalog: list[tuple[str, str, str, str]],
    minimum_position: int = 30,
) -> tuple[int, str] | None:
    """Return earliest strong marker belonging to another feat."""
    current_id, current_cn, current_en, current_raw = feat_identity(current)
    best: tuple[int, str] | None = None

    for feat_id, cn, en, raw in feat_catalog:
        if feat_id and current_id and feat_id == current_id:
            continue
        if cn == current_cn and en == current_en and raw == current_raw:
            continue

        pos = find_flexible_pair(text, cn, en, minimum_position)
        if pos < 0 and raw and len(raw) >= 6:
            pos = text.casefold().find(raw.casefold(), minimum_position)
        if pos < minimum_position:
            continue
        label = raw or f"{cn} ({en})" or feat_id
        if best is None or pos < best[0]:
            best = (pos, label)
    return best


def strip_leading_current_feat_wrapper(text: str, record: dict[str, Any]) -> tuple[str, str | None]:
    """Recover a benefit accidentally stored in prerequisites.

    Example:
        自给自足 CRB 好处：自给自足专长对医疗与生存……

    Returns (cleaned_text, extracted_benefit_or_none).
    """
    cn = clean_spaces(record.get("name_cn") or "")
    if not cn:
        return text, None
    source_group = "|".join(map(re.escape, SOURCE_CODES))
    pattern = re.compile(
        rf"^\s*{re.escape(cn)}(?:\s*[（(][^)）]{{1,100}}[)）])?"
        rf"(?:\s+(?:{source_group})){{0,4}}\s*"
        rf"(?:好处|收益|效果)\s*[:：]\s*(.+)$",
        re.IGNORECASE | re.DOTALL,
    )
    match = pattern.match(text)
    if not match:
        return text, None
    benefit = match.group(1).strip()
    return "", benefit


def append_unique(existing: str, addition: str) -> str:
    existing = str(existing or "").strip()
    addition = str(addition or "").strip()
    if not addition:
        return existing
    if not existing:
        return addition
    if normalize_for_search(addition) in normalize_for_search(existing):
        return existing
    if normalize_for_search(existing) in normalize_for_search(addition):
        return addition
    return f"{existing}\n{addition}"


def repair_feat_records(data: Any, changes: list[FeatChange]) -> None:
    records = collect_unique_feat_records(data)
    catalog = [feat_identity(record) for record in records]

    # We repair every duplicate occurrence because feats-frontend.json may store the same
    # feat in per-book arrays as well as aggregate arrays.
    for record in records:
        feat_id, cn, en, raw = feat_identity(record)
        display = raw or (f"{cn} ({en})" if cn and en else cn or en or feat_id)
        extracted_for_detail: list[str] = []

        for field in FEAT_TEXT_FIELDS:
            value = record.get(field)
            if not isinstance(value, str) or not value.strip():
                continue
            original = value

            boundary = find_other_feat_boundary(value, record, catalog)
            reason_parts: list[str] = []
            removed = ""
            if boundary:
                pos, boundary_label = boundary
                removed = value[pos:]
                value = value[:pos].rstrip(" \t\r\n·•，,；;。")
                reason_parts.append(f"detected next feat heading: {boundary_label}")

            # Recover current feat's own benefit if a polluted prerequisites field begins
            # with the current title + source + 好处：.
            if field == "prerequisites":
                cleaned, extracted = strip_leading_current_feat_wrapper(value, record)
                if extracted is not None:
                    value = cleaned
                    extracted_for_detail.append(extracted)
                    reason_parts.append("moved embedded current-feat benefit out of prerequisites")

            if value != original:
                record[field] = value
                changes.append(
                    FeatChange(
                        feat_id=feat_id,
                        name=display,
                        field=field,
                        before_length=len(original),
                        after_length=len(value),
                        reason="; ".join(reason_parts) or "trimmed polluted text",
                        removed_preview=clean_spaces(removed)[:240],
                    )
                )

        if extracted_for_detail:
            old_detail = str(record.get("detail_text") or "")
            new_detail = old_detail
            for extracted in extracted_for_detail:
                # The extracted text may itself have been followed by later feat records.
                boundary = find_other_feat_boundary(extracted, record, catalog)
                if boundary:
                    extracted = extracted[:boundary[0]].rstrip(" \t\r\n·•，,；;。")
                new_detail = append_unique(new_detail, extracted)
            if new_detail != old_detail:
                record["detail_text"] = new_detail
                changes.append(
                    FeatChange(
                        feat_id=feat_id,
                        name=display,
                        field="detail_text",
                        before_length=len(old_detail),
                        after_length=len(new_detail),
                        reason="recovered own benefit from polluted prerequisites",
                        removed_preview="",
                    )
                )


def js_object_literal(mapping: dict[str, str], indent: str = "    ") -> str:
    lines = ["{"]
    items = list(mapping.items())
    for index, (key, value) in enumerate(items):
        comma = "," if index < len(items) - 1 else ""
        escaped_key = key.replace("\\", "\\\\").replace("'", "\\'")
        escaped_value = value.replace("\\", "\\\\").replace("'", "\\'")
        lines.append(f"{indent}    '{escaped_key}': '{escaped_value}'{comma}")
    lines.append(f"{indent}}}")
    return "\n".join(lines)


def canonical_js_maps() -> tuple[dict[str, str], dict[str, str]]:
    # Full Chinese table includes existing project vocabulary plus approved corrections.
    zh = {
        "炼金术师": "炼金术师", "炼金术士": "炼金术师", "练金术师": "炼金术师", "炼金师": "炼金术师",
        "调查员": "调查员", "调查者": "调查员",
        "反圣骑士": "反圣骑士", "反圣武士": "反圣骑士",
        "术士": "术士", "法师": "法师", "法术": "法师", "巫师": "法师",
        "奥能师": "奥能师", "奥能者": "奥能师",
        "牧师": "牧师", "先知": "先知", "战斗祭司": "战斗祭司", "战争祭司": "战斗祭司",
        "吟游诗人": "吟游诗人", "吟游吟游诗人": "吟游诗人", "吟游诗人诗人": "吟游诗人",
        "吟游诗人诗": "吟游诗人", "吟游诗": "吟游诗人", "游吟诗人": "吟游诗人", "诗人": "吟游诗人",
        "唤魂师": "唤魂师", "唤魂者": "唤魂师", "唤灵师": "唤魂师", "唤师师": "唤魂师",
        "魔战士": "魔战士", "魔战": "魔战士",
        "召唤师": "召唤师", "召唤旒": "召唤师", "召唤师 U": "召唤师", "召唤师 Unchained": "召唤师",
        "歌者": "歌者",
        "血脉狂怒者": "血脉狂怒者", "血脉狂暴者": "血脉狂怒者", "血脉暴怒者": "血脉狂怒者",
        "德鲁伊": "德鲁伊", "猎人": "猎人", "萨满": "萨满", "女巫": "女巫",
        "审判者": "审判者", "异能者": "异能者", "异能师": "异能者",
        "秘学士": "秘学士", "密学士": "秘学士", "催眠师": "催眠师", "惟眠师": "催眠师",
        "通灵者": "通灵者", "通灵师": "通灵者",
        "圣武士": "圣骑士", "圣骑士": "圣骑士", "游侠": "游侠", "盗贼": "盗贼",
        "导师": "导师", "红螳螂杀手": "红螳螂杀手",
    }
    en = {
        "sorcerer": "术士", "wizard": "法师", "arcanist": "奥能师", "cleric": "牧师",
        "oracle": "先知", "warpriest": "战斗祭司", "druid": "德鲁伊", "hunter": "猎人",
        "shaman": "萨满", "witch": "女巫", "summoner": "召唤师", "summoner u": "召唤师",
        "summoner unchained": "召唤师", "summoner (unchained)": "召唤师",
        "inquisitor": "审判者", "psychic": "异能者", "occultist": "秘学士", "magus": "魔战士",
        "bard": "吟游诗人", "skald": "歌者", "paladin": "圣骑士", "antipaladin": "反圣骑士",
        "ranger": "游侠", "rogue": "盗贼", "alchemist": "炼金术师", "investigator": "调查员",
        "bloodrager": "血脉狂怒者", "mesmerist": "催眠师", "medium": "通灵者",
        "spiritualist": "通灵者", "redmantisassassin": "红螳螂杀手",
    }
    return zh, en


def patch_js_alias_maps(path: Path) -> bool:
    text = path.read_text(encoding="utf-8-sig")
    original = text
    zh, en = canonical_js_maps()

    pattern_zh = re.compile(
        r"(?P<prefix>const\s+PROFESSION_CANON\s*=\s*)\{.*?\n\s*\};",
        re.DOTALL,
    )
    pattern_en = re.compile(
        r"(?P<prefix>const\s+PROFESSION_EN_TO_ZH\s*=\s*)\{.*?\n\s*\};",
        re.DOTALL,
    )

    def replace_zh(match: re.Match[str]) -> str:
        base_indent = re.search(r"(^|\n)([ \t]*)const\s+PROFESSION_CANON", text[: match.start() + 50])
        indent = base_indent.group(2) if base_indent else "    "
        literal = js_object_literal(zh, indent)
        return f"{match.group('prefix')}{literal};"

    def replace_en(match: re.Match[str]) -> str:
        base_indent = re.search(r"(^|\n)([ \t]*)const\s+PROFESSION_EN_TO_ZH", text[: match.start() + 50])
        indent = base_indent.group(2) if base_indent else "    "
        literal = js_object_literal(en, indent)
        return f"{match.group('prefix')}{literal};"

    text, count_zh = pattern_zh.subn(replace_zh, text, count=1)
    text, count_en = pattern_en.subn(replace_en, text, count=1)
    if count_zh != 1 or count_en != 1:
        raise RuntimeError(f"Could not locate alias maps in {path}")
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def backup_file(root: Path, backup_root: Path, path: Path) -> None:
    relative = path.relative_to(root)
    target = backup_root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)


def repair_repository(root: Path, apply: bool) -> dict[str, Any]:
    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = root / ".repair-backup" / timestamp
    report_dir = root / "repair-reports"
    report_dir.mkdir(parents=True, exist_ok=True)

    spell_changes: list[SpellChange] = []
    feat_changes: list[FeatChange] = []
    js_changes: list[JsPatchChange] = []
    modified_files: list[str] = []

    # Spell JSON files
    for path in find_spell_files(root):
        try:
            data = load_json(path)
        except Exception as exc:
            print(f"[WARN] Skip unreadable JSON {path}: {exc}", file=sys.stderr)
            continue
        before_change_count = len(spell_changes)
        for record in walk_json(data):
            if looks_like_spell_record(record):
                repair_spell_record(record, str(path.relative_to(root)), spell_changes)
        if len(spell_changes) > before_change_count:
            modified_files.append(str(path.relative_to(root)))
            if apply:
                backup_file(root, backup_root, path)
                write_json(path, data)

    # Feat frontend data
    feat_path = root / "result" / "feats" / "feats-frontend.json"
    if feat_path.exists():
        try:
            feat_data = load_json(feat_path)
            repair_feat_records(feat_data, feat_changes)
            if feat_changes:
                modified_files.append(str(feat_path.relative_to(root)))
                if apply:
                    backup_file(root, backup_root, feat_path)
                    write_json(feat_path, feat_data)
        except Exception as exc:
            raise RuntimeError(f"Failed to repair feat data {feat_path}: {exc}") from exc

    # JavaScript runtime maps
    for relative in ("web/assets/js/spell-rag.js", "web/assets/js/spell-filter-core.js"):
        path = root / relative
        if not path.exists():
            js_changes.append(JsPatchChange(relative, False))
            continue
        if apply:
            backup_file(root, backup_root, path)
            changed = patch_js_alias_maps(path)
        else:
            # Patch a temporary copy to validate and detect whether it changes.
            temp = report_dir / f".{path.name}.{timestamp}.tmp"
            shutil.copy2(path, temp)
            try:
                changed = patch_js_alias_maps(temp)
            finally:
                temp.unlink(missing_ok=True)
        js_changes.append(JsPatchChange(relative, changed))
        if changed:
            modified_files.append(relative)

    report = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "mode": "apply" if apply else "dry-run",
        "approved_policy": {
            "poet_to_bard": True,
            "unchained_summoner_to_summoner": True,
            "psychic_to": "异能者",
        },
        "summary": {
            "spell_field_changes": len(spell_changes),
            "feat_field_changes": len(feat_changes),
            "javascript_files_changed": sum(1 for item in js_changes if item.changed),
            "modified_file_count": len(set(modified_files)),
        },
        "modified_files": sorted(set(modified_files)),
        "spell_changes": [asdict(item) for item in spell_changes],
        "feat_changes": [asdict(item) for item in feat_changes],
        "javascript_changes": [asdict(item) for item in js_changes],
        "backup_directory": str(backup_root.relative_to(root)) if apply else None,
    }

    report_path = report_dir / f"content-repair-{timestamp}-{'apply' if apply else 'dry-run'}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report["report_path"] = str(report_path.relative_to(root))
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Write repaired data and JS files")
    mode.add_argument("--dry-run", action="store_true", help="Only write an audit report (default)")
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="Repository root (default: current directory)")
    args = parser.parse_args()

    root = args.root.resolve()
    if not (root / "web").exists() or not (root / "result").exists():
        parser.error(f"{root} does not look like the repository root (web/ or result/ missing)")

    report = repair_repository(root, apply=bool(args.apply))
    summary = report["summary"]
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Audit report: {report['report_path']}")
    if args.apply:
        print(f"Backups: {report['backup_directory']}")
    else:
        print("Dry run only. Re-run with --apply after reviewing the report.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
