"""数据加载与统一模块"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

from api.config import settings
from api.models import SpellRecord
from api.utils.text_utils import (
    clean_text,
    split_name,
    split_spell_resistance_text,
    split_polluted_field,
    recover_level_from_effect,
    parse_level_entries,
    extract_source_from_path,
)

LEVEL_OVERRIDES = {
    "Wall ofEctoplasm": "牧师 5，异能者 5，术士/法师 5，唤魂师 5",
    "Wall of Ectoplasm": "牧师 5，异能者 5，术士/法师 5，唤魂师 5",
}


def _spell_type_from_source_or_payload(source: str, spell_dict: Dict) -> str:
    raw_fields = spell_dict.get("raw_fields") or {}
    value = (
        spell_dict.get("spell_type")
        or spell_dict.get("法术类型")
        or raw_fields.get("法术类型")
        or ""
    )
    value_text = str(value).strip().lower()
    if value_text in {"mythic", "神话", "神话法术"}:
        return "mythic"
    if source.upper() == "MA" or str(spell_dict.get("source_book", "")).upper() == "MA":
        return "mythic"
    return "normal"


def load_spells() -> List[SpellRecord]:
    """加载所有来源的法术数据并统一为 SpellRecord
    
    Returns:
        统一的法术记录列表
    """
    all_spells: List[SpellRecord] = []
    project_root = settings.PROJECT_ROOT
    
    for source_path in settings.SPELL_SOURCES:
        full_path = project_root / source_path
        
        if not full_path.exists():
            print(f"警告: 文件不存在: {full_path}")
            continue
        
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            source = extract_source_from_path(source_path)
            
            # 检测 schema 类型（模型格式有 spell_id 字段）
            is_model_format = (
                isinstance(data, list)
                and len(data) > 0
                and isinstance(data[0], dict)
                and "spell_id" in data[0]
            )
            
            for idx, spell_dict in enumerate(data):
                try:
                    if is_model_format:
                        record = _convert_model_format(spell_dict, source, idx)
                    else:
                        record = _convert_legacy_format(spell_dict, source, idx)
                    
                    if record:
                        all_spells.append(record)
                except Exception as e:
                    print(f"警告: 转换法术失败 ({source_path}, index {idx}): {e}")
                    continue
        
        except Exception as e:
            print(f"错误: 加载文件失败 ({source_path}): {e}")
            continue
    
    print(f"成功加载 {len(all_spells)} 条法术记录")
    return all_spells


def _convert_legacy_format(spell_dict: Dict, source: str, index: int) -> SpellRecord | None:
    """转换老格式（中文字段）为 SpellRecord"""
    name = spell_dict.get("name", "").strip()
    if not name:
        return None
    
    name_zh, name_en = split_name(name)
    
    effect = spell_dict.get("效果", "") or spell_dict.get("法术效果", "")

    # 提取等级信息
    level_raw, level_remainder = split_polluted_field("level", spell_dict.get("等级", ""))
    if level_remainder:
        effect = "\n".join(part for part in [effect.strip(), level_remainder] if part)
    level_raw, effect = recover_level_from_effect(level_raw, effect)
    level_raw = _apply_level_override(name, level_raw)
    level_by_class = parse_level_entries(level_raw)

    cast_time, cast_time_remainder = split_polluted_field(
        "cast_time", spell_dict.get("施法时间", "")
    )
    components, components_remainder = split_polluted_field(
        "components", spell_dict.get("成分", "")
    )
    spell_range, range_remainder = split_polluted_field(
        "range", spell_dict.get("范围", "")
    )
    target, target_remainder = split_polluted_field(
        "target", spell_dict.get("目标", "")
    )
    duration, duration_remainder = split_polluted_field(
        "duration", spell_dict.get("持续", "") or spell_dict.get("持续时间", "")
    )
    save, save_remainder = split_polluted_field("save", spell_dict.get("豁免", ""))
    spell_resistance, sr_remainder = split_spell_resistance_text(
        spell_dict.get("法术抗力", "")
    )
    remainders = [
        components_remainder,
        range_remainder,
        target_remainder,
        duration_remainder,
        save_remainder,
        sr_remainder,
        cast_time_remainder,
    ]
    for remainder in remainders:
        if remainder:
            effect = "\n".join(part for part in [effect.strip(), remainder] if part)
    
    return SpellRecord(
        spell_id=f"{source.lower()}-{index:04d}",
        name=name,
        name_zh=name_zh,
        name_en=name_en,
        source=source,
        spell_type=_spell_type_from_source_or_payload(source, spell_dict),
        school=clean_text(spell_dict.get("学派", "")),
        level_raw=level_raw,
        level_by_class=level_by_class,
        cast_time=clean_text(cast_time),
        components=clean_text(components),
        range=clean_text(spell_range),
        target=clean_text(target),
        duration=clean_text(duration),
        save=clean_text(save),
        spell_resistance=clean_text(spell_resistance),
        effect=clean_text(effect),
    )


def _convert_model_format(spell_dict: Dict, source: str, index: int) -> SpellRecord | None:
    """转换模型格式（英文字段）为 SpellRecord"""
    name = spell_dict.get("name", "").strip()
    if not name:
        return None
    
    name_zh, name_en = split_name(name)
    
    # 效果字段：优先用 effect，其次用 raw_fields.效果
    effect = spell_dict.get("effect", "").strip()
    if not effect and "raw_fields" in spell_dict:
        effect = spell_dict["raw_fields"].get("效果", "").strip()

    # 模型格式可能已有 level_by_class
    level_by_class = spell_dict.get("level_by_class", [])
    level_raw, level_remainder = split_polluted_field(
        "level", spell_dict.get("level_raw", "")
    )
    if level_remainder:
        effect = "\n".join(part for part in [effect.strip(), level_remainder] if part)
    level_raw, effect = recover_level_from_effect(level_raw, effect)
    level_raw = _apply_level_override(name, level_raw)
    
    # 如果没有 level_by_class，尝试从 level_raw 解析
    level_by_class = parse_level_entries(level_raw) or level_by_class
    
    # 法术抗力：优先用 spell_resistance，其次用 raw_fields.法术抗力
    spell_resistance = spell_dict.get("spell_resistance", "").strip()
    if not spell_resistance and "raw_fields" in spell_dict:
        spell_resistance = spell_dict["raw_fields"].get("法术抗力", "").strip()
    
    cast_time, cast_time_remainder = split_polluted_field(
        "cast_time", spell_dict.get("cast_time", "")
    )
    components, components_remainder = split_polluted_field(
        "components", spell_dict.get("components", "")
    )
    spell_range, range_remainder = split_polluted_field(
        "range", spell_dict.get("range", "")
    )
    target, target_remainder = split_polluted_field(
        "target", spell_dict.get("target", "")
    )
    duration, duration_remainder = split_polluted_field(
        "duration", spell_dict.get("duration", "")
    )
    save, save_remainder = split_polluted_field("save", spell_dict.get("save", ""))
    spell_resistance, sr_remainder = split_spell_resistance_text(spell_resistance)
    for remainder in [
        components_remainder,
        range_remainder,
        target_remainder,
        duration_remainder,
        save_remainder,
        sr_remainder,
        cast_time_remainder,
    ]:
        if remainder:
            effect = "\n".join(part for part in [effect.strip(), remainder] if part)
    
    # 使用 spell_id 如果存在，否则生成
    spell_id = spell_dict.get("spell_id", f"{source.lower()}-{index:04d}")
    
    return SpellRecord(
        spell_id=spell_id,
        name=name,
        name_zh=name_zh,
        name_en=name_en,
        source=spell_dict.get("source_book", source).upper(),
        spell_type=_spell_type_from_source_or_payload(source, spell_dict),
        school=clean_text(spell_dict.get("school", "")),
        level_raw=level_raw,
        level_by_class=level_by_class,
        cast_time=clean_text(cast_time),
        components=clean_text(components),
        range=clean_text(spell_range),
        target=clean_text(target),
        duration=clean_text(duration),
        save=clean_text(save),
        spell_resistance=clean_text(spell_resistance),
        effect=clean_text(effect),
    )


def _apply_level_override(name: str, level_raw: str) -> str:
    for key, value in LEVEL_OVERRIDES.items():
        if key in name:
            return value
    return level_raw
