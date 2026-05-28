"""LLM 生成模块"""
from __future__ import annotations

import asyncio
import time
from typing import Dict, List, Any

from openai import AsyncOpenAI

from api.config import settings
from api.models import Citation


# System Prompt 模板
SYSTEM_PROMPT = """你是 Pathfinder RPG 法术知识助手，专门基于提供的法术数据回答问题。

## 回答规则
1. **只使用【检索结果】中的法术信息**，绝不编造不存在的法术或属性
2. 回答末尾必须列出 **【引用】** 部分，格式为"法术名 — 来源书"
3. 如果检索结果中找不到足以回答的信息，明确回复"未检索到相关法术"
4. 对比类问题请使用 **Markdown 表格** 展示字段差异
5. 精确字段查询（施法时间/等级/豁免等）请直接给出准确值，不要扩写
6. 检索结果只是候选集。回答条件检索类问题时，必须逐一判断候选法术是否真的符合用户要求；不符合的候选不要列入答案。
7. 除非用户指定数量上限，否则不要固定只列5个；请在检索结果范围内列出所有符合条件的法术，并可在答案开头说明"在检索到的候选中"。

## 回答格式
- 单法术问答：先给结论，再列字段明细
- 条件检索：列出所有符合条件的法术，每个注明命中依据和关键属性；如果某些候选明显不符合条件，忽略它们
- 对比问答：表格对比 + 一句总结

【检索结果】
{context}

【用户问题】
{question}"""


class LLMGenerator:
    """LLM 生成器"""
    
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_BASE_URL,
            timeout=settings.LLM_TIMEOUT,
        )
        self.model = settings.LLM_MODEL
        self.max_tokens = settings.LLM_MAX_TOKENS
        self.temperature = settings.LLM_TEMPERATURE
    
    async def generate_answer(
        self,
        question: str,
        context_chunks: List[Dict[str, Any]],
        api_key: str | None = None,
    ) -> tuple[str, List[Citation], bool, str | None]:
        """生成回答
        
        Args:
            question: 用户问题
            context_chunks: 检索到的上下文块列表（来自 retriever.search）
        
        Returns:
            (answer_text, citations, degraded, llm_error) 元组
            degraded=True 表示 LLM 调用失败，仅返回检索结果
        """
        if not context_chunks:
            return "未检索到相关法术。", [], False, None
        request_api_key = (api_key or "").strip()
        effective_api_key = request_api_key or settings.LLM_API_KEY
        if not effective_api_key:
            return (
                self._generate_fallback_answer(context_chunks),
                [],
                True,
                "LLM_API_KEY 未配置",
            )
        
        # 构建上下文
        context_parts = []
        seen_spell_ids = set()
        
        for chunk in context_chunks:
            spell = chunk["spell_record"]
            if spell.spell_id in seen_spell_ids:
                continue
            seen_spell_ids.add(spell.spell_id)
            
            context_parts.append(
                f"法术：{spell.name}\n"
                f"来源：{spell.source}\n"
                f"类型：{'神话法术' if spell.spell_type == 'mythic' else '普通法术'}\n"
                f"{chunk['context_text']}"
            )
        
        context = "\n\n---\n\n".join(context_parts)
        
        # 构建 Prompt
        system_content = SYSTEM_PROMPT.format(
            context=context,
            question=question
        )
        
        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": question}
        ]
        
        # 调用 LLM（带超时和错误处理）
        try:
            client = self.client
            if request_api_key:
                client = AsyncOpenAI(
                    api_key=request_api_key,
                    base_url=settings.LLM_BASE_URL,
                    timeout=settings.LLM_TIMEOUT,
                )
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    max_tokens=self.max_tokens,
                    temperature=self.temperature,
                ),
                timeout=settings.LLM_TIMEOUT,
            )
            
            answer_text = response.choices[0].message.content
            
            # 提取引证
            citations = self._extract_citations(answer_text, context_chunks)
            
            return answer_text, citations, False, None
        
        except asyncio.TimeoutError:
            # 超时：降级为纯检索结果
            return (
                self._generate_fallback_answer(context_chunks),
                [],
                True,
                f"LLM 调用超时（>{settings.LLM_TIMEOUT}s）",
            )
        
        except Exception as e:
            # 其他错误：降级
            print(f"LLM 调用失败: {e}")
            return (
                self._generate_fallback_answer(context_chunks),
                [],
                True,
                str(e),
            )
    
    def _extract_citations(
        self,
        answer_text: str,
        context_chunks: List[Dict[str, Any]]
    ) -> List[Citation]:
        """从回答文本中提取引证"""
        citations = []
        seen_spell_ids = set()
        
        for chunk in context_chunks:
            spell = chunk["spell_record"]
            if spell.spell_id in seen_spell_ids:
                continue
            
            # 检查回答中是否提到这个法术（简单匹配名称），忽略空名称。
            name_tokens = [spell.name, spell.name_zh, spell.name_en]
            if any(token and token in answer_text for token in name_tokens):
                citations.append(Citation(
                    spell_id=spell.spell_id,
                    name=spell.name,
                    source=spell.source,
                ))
                seen_spell_ids.add(spell.spell_id)
        
        # 如果没有找到引证，至少返回第一个检索结果
        if not citations and context_chunks:
            spell = context_chunks[0]["spell_record"]
            citations.append(Citation(
                spell_id=spell.spell_id,
                name=spell.name,
                source=spell.source,
            ))
        
        return citations
    
    def _generate_fallback_answer(
        self,
        context_chunks: List[Dict[str, Any]]
    ) -> str:
        """生成降级回答（仅基于检索结果）"""
        if not context_chunks:
            return "未检索到相关法术。"
        
        answer_parts = ["根据检索结果，找到以下相关候选法术：\n"]
        
        for i, chunk in enumerate(context_chunks[:20], 1):
            spell = chunk["spell_record"]
            answer_parts.append(
                f"{i}. **{spell.name}** ({spell.source})\n"
                f"   类型：{'神话法术' if spell.spell_type == 'mythic' else '普通法术'}\n"
                f"   学派：{spell.school}\n"
                f"   等级：{spell.level_raw}\n"
            )
        
        answer_parts.append("\n*注：LLM 生成服务暂不可用，以上为检索结果。*")
        
        return "\n".join(answer_parts)
