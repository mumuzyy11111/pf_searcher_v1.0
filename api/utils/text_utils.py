"""文本处理工具函数"""
from __future__ import annotations

import re
from typing import Dict, List, Tuple


def clean_text(text: str) -> str:
    """清洗文本：去除多余空白、特殊字符"""
    if not text:
        return ""
    # 替换各种空白字符为单个空格
    text = re.sub(r"[\s\xa0\u3000]+", " ", text)
    return text.strip()


def split_spell_resistance_text(text: str) -> Tuple[str, str]:
    """拆分被正文污染的法术抗力字段。

    部分抽取结果会把“可/否/无/见下文”后的描述正文并入法术抗力。
    返回 (法术抗力, 被拆出的正文)。
    """
    text = clean_text(text)
    if not text:
        return "", ""

    match = re.match(
        r"^((?:可|否|无|有|见下文|见后文)"
        r"(?:\s*[,，;；]\s*见[下后]文)?"
        r"(?:\s*[（(][^）)]{1,30}[）)])?"
        r"(?:和(?:可|否|无|有)[（(][^）)]{1,30}[）)])?)\s+(.+)$",
        text,
    )
    if not match:
        return text, ""

    resistance = match.group(1).strip()
    remainder = match.group(2).strip()
    if remainder.startswith(("(", "（")) and remainder.endswith((")", "）")):
        return text, ""
    if len(remainder) < 8:
        return text, ""
    return resistance, remainder


def split_polluted_field(field: str, text: str) -> Tuple[str, str]:
    """拆分常见短字段中误并入的正文。

    返回 (清洗后的字段值, 被拆出的正文)。无法可靠拆分时保留原值。
    """
    text = clean_text(text)
    if not text:
        return "", ""

    if field == "spell_resistance":
        return split_spell_resistance_text(text)

    if field == "level":
        return _split_level_text(text)

    if field == "duration":
        value, remainder = _split_duration_prefix(text)
        if remainder:
            return value, remainder
        value, remainder = _split_at_prose_marker(
            text,
            [
                " 当你",
                " 你",
                " 若",
                " 如果",
                " 该法术",
                " 此法术",
                " 这个法术",
                " 树木种类",
            ],
        )
        if remainder:
            return value, remainder
        duration_note_pos = text.find(" 你无法")
        if duration_note_pos > 0:
            return text[:duration_note_pos].strip(), text[duration_note_pos:].strip()
        if len(text) > 120 and not re.match(
            r"^(?:\d|1d|专注|立即|永久|瞬时|见|特殊|每|直至|直到)", text
        ):
            return "", text
        return text, ""

    if field == "target":
        if "(Targeted Dispel)" in text or text.startswith(("获得DR", "受到每", "火器会", "武器持有者")):
            return "", text
        value, remainder = _split_at_prose_marker(
            text,
            [" 该法术", " 此法术", " 这个法术", " 当你", " 如果", " 若", " 成功的", " 通过", " 除了"],
        )
        if remainder:
            if len(value) > 220:
                return "", text
            return value, remainder
        if len(text) > 220:
            return "", text
        return text, ""

    if field == "range":
        if "(Area Dispel)" in text or text.startswith("型解除"):
            return "", text
        value, remainder = _split_at_prose_marker(
            text,
            [" 该法术", " 此法术", " 这个法术", " 当你", " 如果", " 若", " 一旦", " 除了"],
        )
        if remainder:
            return value, remainder
        if len(text) > 120:
            return "", text
        return text, ""

    if field == "save":
        value, remainder = _split_at_prose_marker(
            text,
            [" 此法术", " 该法术", " 这个法术", " 当你", " 如果", " 若", " 被射线"],
        )
        if remainder:
            return value, remainder
        if len(text) > 200:
            return "", text
        return text, ""

    if field == "components":
        value, remainder = _split_at_prose_marker(
            text,
            [" 此法术", " 该法术", " 这个法术", " 法术完成后", " 当你", " 如果", " 若"],
        )
        if remainder:
            return value, remainder
        return text, ""

    return text, ""


def recover_level_from_effect(level_text: str, effect_text: str) -> Tuple[str, str]:
    """从效果开头回收被错误切走的等级片段。

    例：level="牧师"，effect="4，审判者 4，通灵者 3...正文"
    -> level="牧师 4，审判者 4，通灵者 3...", effect="正文"
    """
    level_text = clean_text(level_text)
    effect_text = clean_text(effect_text)
    if not level_text or not effect_text:
        return level_text, effect_text
    if parse_level_entries(level_text):
        return level_text, effect_text

    lead = re.match(r"^(\d)(?:\s*[，,、]\s*|\s+)(.+)$", effect_text)
    if not lead:
        return level_text, effect_text

    first_level = lead.group(1)
    rest = lead.group(2).strip()
    entries = []
    last_end = 0
    pos = 0
    entry_pattern = re.compile(
        r"\s*(?:[，,、]\s*)?([^，,、。；;0-9]{1,20}?)\s*(\d)"
        r"(?=\s*[，,、]|[。；;]|\s|$)"
    )
    while pos < len(rest):
        match = entry_pattern.match(rest, pos)
        if not match:
            break
        class_name = clean_text(match.group(1))
        if not class_name or len(class_name) > 20:
            break
        entries.append(f"{class_name} {match.group(2)}")
        last_end = match.end()
        pos = match.end()

    recovered = [f"{level_text} {first_level}", *entries]
    if len(recovered) == 1 and not entries:
        remainder = rest
    else:
        remainder = rest[last_end:].strip(" ，,；;")

    if len(remainder) < 10:
        return level_text, effect_text

    return "，".join(recovered), remainder


def _split_at_prose_marker(text: str, markers: List[str]) -> Tuple[str, str]:
    positions = [text.find(marker) for marker in markers if text.find(marker) > 0]
    if not positions:
        return text, ""
    pos = min(positions)
    value = text[:pos].strip()
    remainder = text[pos:].strip()
    if len(value) < 1 or len(remainder) < 20:
        return text, ""
    return value, remainder


def _split_duration_prefix(text: str) -> Tuple[str, str]:
    match = re.match(
        r"^("
        r"(?:\d+d?\d*(?:[+x×]\d+)?|\d+)"
        r"[^ ]{0,30}"
        r"(?:\s*[（(][^）)]{1,30}[）)])?"
        r"(?:\s*或\s*[^ ]{1,30}(?:\s*[（(][^）)]{1,30}[）)])?)?"
        r")\s+(.+)$",
        text,
    )
    if not match:
        return text, ""
    value = match.group(1).strip()
    remainder = match.group(2).strip()
    if len(remainder) < 20:
        return text, ""
    return value, remainder


def _split_level_text(text: str) -> Tuple[str, str]:
    """保留开头的职业/领域等级列表，把后续说明正文拆出。"""
    if not text:
        return "", ""

    entry_re = re.compile(
        r"\s*(?:[,，、;；]\s*)?((?:领域\s+)?[^,，、;；0-9]{1,30}?\s*[0-9])"
    )
    pos = 0
    last_end = 0
    matched = False
    while pos < len(text):
        match = entry_re.match(text, pos)
        if not match:
            break
        matched = True
        last_end = match.end()
        pos = match.end()

    if not matched:
        return text, ""

    value = text[:last_end].strip(" ,，、;；")
    remainder = text[last_end:].strip()
    if len(remainder) < 20:
        return text, ""
    return value, remainder


def split_name(name: str) -> Tuple[str, str]:
    """拆分法术名称中的中英文
    
    Args:
        name: 法术名称，如 "火球术 (Fireball)" 或 "Fireball"
    
    Returns:
        (name_zh, name_en) 元组
    """
    if not name:
        return "", ""
    
    # 匹配 "中文 (English)" 或 "中文(English)" 格式
    match = re.match(r"^(.+?)\s*[（(]\s*([A-Za-z][^）)]+)\s*[）)]\s*$", name)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    
    # 如果只有英文（无中文括号）
    if re.match(r"^[A-Za-z]", name):
        return "", name.strip()
    
    # 如果只有中文
    if re.search(r"[\u4e00-\u9fff]", name):
        return name.strip(), ""
    
    return name.strip(), ""


def parse_level_entries(level_text: str) -> List[Dict[str, any]]:
    """解析等级文本为结构化列表
    
    Args:
        level_text: 如 "术士/法师 3, 牧师 4" 或 "魔战士 5, 术士/法师 5"
    
    Returns:
        [{"class": "术士/法师", "level": 3}, ...]
    """
    if not level_text:
        return []
    
    entries = []
    level_text = re.sub(r"(\d)(?=[\u4e00-\u9fff])", r"\1，", level_text)
    # 按逗号或换行分割
    parts = re.split(r"[，,、；;\n]", level_text)
    
    for part in parts:
        part = part.strip()
        if not part:
            continue
        
        # 匹配 "职业名 数字" 格式
        match = re.match(r"^(.+?)\s*(\d+)(?:\s*$|.+$)", part)
        if match:
            class_name = canonicalize_profession(match.group(1).strip())
            if class_name.startswith("领域") or class_name.endswith(("领域", "子域")):
                continue
            level = int(match.group(2))
            for item in class_name.split("/"):
                item = canonicalize_profession(item.strip())
                if not item:
                    continue
                if item.startswith("领域") or item.endswith(("领域", "子域")):
                    continue
                entries.append({"class": item, "level": level})
    
    return entries


def canonicalize_profession(name: str) -> str:
    """规范化职业名称
    
    统一变体，如 "炼金术师" -> "炼金术士"
    """
    if not name:
        return ""
    
    # 规范化分隔符
    name = name.replace("／", "/").replace("\\", "/")
    name = re.sub(r"\s*/\s*", "/", name)
    name = re.sub(r"\s+", " ", name).strip()
    
    # 职业名映射
    profession_map = {
        "炼金术士": "炼金术师",
        "反圣武士": "反圣骑士",
        "调查者": "调查员",
        "吟游诗人诗人": "吟游诗人",
        "游吟诗人": "吟游诗人",
        "吟游诗人诗": "吟游诗人",
        "吟游诗": "吟游诗人",
        "唤魂者": "唤魂师",
        "唤灵师": "唤魂师",
        "唤师师": "唤魂师",
    }
    
    # 处理 "牧师/先知" 的变体
    if "牧师" in name and "先知" in name:
        name = "牧师/先知"
    
    return profession_map.get(name, name)


def build_search_text(spell: Dict[str, any]) -> str:
    """构建全文检索文本
    
    合并所有可检索字段，用于 BM25 索引
    """
    parts = [
        spell.get("name", ""),
        spell.get("spell_type", ""),
        spell.get("school", ""),
        spell.get("level_raw", ""),
        spell.get("cast_time", ""),
        spell.get("components", ""),
        spell.get("range", ""),
        spell.get("target", ""),
        spell.get("duration", ""),
        spell.get("save", ""),
        spell.get("spell_resistance", ""),
        spell.get("effect", ""),
    ]
    return " ".join(filter(None, parts))


def extract_source_from_path(path: str) -> str:
    """从文件路径提取来源书缩写"""
    # 从路径如 "result/crb/spells-crb.json" 提取 "CRB"
    match = re.search(r"/([a-z0-9_]+)/spells-", path.lower())
    if match:
        source_code = match.group(1).upper()
        # 映射
        source_map = {
            "CRB": "CRB",
            "APG": "APG",
            "ACG": "ACG",
            "ARG": "ARG",
            "UC": "UC",
            "UM": "UM",
            "UI": "UI",
            "OA": "OA",
        }
        return source_map.get(source_code, source_code)
    return "UNKNOWN"
