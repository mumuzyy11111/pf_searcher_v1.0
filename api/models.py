"""Pydantic 数据模型定义"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SpellRecord(BaseModel):
    """统一的法术记录结构"""
    spell_id: str = Field(..., description="法术唯一标识，格式：{source}-{序号}")
    name: str = Field(..., description="法术名称（含中英文）")
    name_zh: str = Field(default="", description="中文名")
    name_en: str = Field(default="", description="英文名")
    source: str = Field(..., description="来源书缩写")
    spell_type: str = Field(default="normal", description="法术类型：normal/mythic")
    school: str = Field(default="", description="学派")
    level_raw: str = Field(default="", description="原始等级文本")
    level_by_class: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="等级结构化列表：[{'class': '术士/法师', 'level': 3}, ...]"
    )
    cast_time: str = Field(default="", description="施法时间")
    components: str = Field(default="", description="成分")
    range: str = Field(default="", description="范围")
    target: str = Field(default="", description="目标")
    duration: str = Field(default="", description="持续时间")
    save: str = Field(default="", description="豁免")
    spell_resistance: str = Field(default="", description="法术抗力")
    effect: str = Field(default="", description="效果/描述全文")

    class Config:
        json_schema_extra = {
            "example": {
                "spell_id": "crb-0001",
                "name": "火球术 (Fireball)",
                "name_zh": "火球术",
                "name_en": "Fireball",
                "source": "CRB",
                "spell_type": "normal",
                "school": "塑能系 [火]",
                "level_raw": "术士/法师 3",
                "level_by_class": [{"class": "术士/法师", "level": 3}],
                "cast_time": "标准动作",
                "components": "语言, 姿势, 材料",
                "range": "远距",
                "target": "",
                "duration": "立即",
                "save": "反射，通过则减半",
                "spell_resistance": "可",
                "effect": "（描述正文）"
            }
        }


class RagSearchRequest(BaseModel):
    """RAG 检索请求"""
    question: str = Field(..., description="用户问题")
    top_k: int = Field(default=20, ge=1, le=20, description="返回结果数量")
    filters: Dict[str, Any] = Field(
        default_factory=dict,
        description="过滤条件：{'source': 'CRB', 'school': '防护', 'max_level': 3}"
    )


class RagSearchResponse(BaseModel):
    """RAG 检索响应"""
    hits: List[Dict[str, Any]] = Field(..., description="命中法术列表")
    total: int = Field(..., description="总命中数")
    latency_ms: int = Field(..., description="延迟（毫秒）")


class RagAskRequest(BaseModel):
    """RAG 问答请求"""
    question: str = Field(..., description="用户问题")
    top_k: int = Field(default=20, ge=1, le=20, description="检索结果数量")
    filters: Dict[str, Any] = Field(
        default_factory=dict,
        description="过滤条件"
    )
    api_key: Optional[str] = Field(
        default=None,
        description="User-provided LLM API key for this request. It is not persisted.",
    )


class Citation(BaseModel):
    """引证信息"""
    spell_id: str
    name: str
    source: str


class RagAskResponse(BaseModel):
    """RAG 问答响应"""
    answer: str = Field(..., description="LLM 生成的回答")
    citations: List[Citation] = Field(..., description="引用的法术列表")
    retrieved_count: int = Field(..., description="检索到的法术数")
    latency_ms: int = Field(..., description="总延迟（毫秒）")
    degraded: bool = Field(
        default=False,
        description="是否降级（LLM 失败时仅返回检索结果）"
    )
    llm_error: Optional[str] = Field(
        default=None,
        description="LLM 调用失败原因（仅降级时返回）",
    )


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str = Field(..., description="服务状态")
    spell_count: int = Field(..., description="索引中的法术数")
    index_built_at: Optional[str] = Field(None, description="索引构建时间")
    version: str = Field(..., description="版本号")
