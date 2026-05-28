"""混合检索模块"""
from __future__ import annotations

import pickle
import re
import time
from pathlib import Path
from typing import Dict, List, Tuple, Any

import chromadb
from chromadb.config import Settings as ChromaSettings
from rank_bm25 import BM25Okapi
import jieba

from api.config import settings
from api.models import SpellRecord
from api.services.data_loader import load_spells
from api.services.embedding_client import create_embedding_client
from api.utils.text_utils import build_search_text


class HybridRetriever:
    """混合检索器（BM25 + Vector + RRF）"""
    
    def __init__(self):
        self.project_root = settings.PROJECT_ROOT
        self.chroma_dir = self.project_root / settings.CHROMA_PERSIST_DIR
        self.bm25_path = self.project_root / settings.BM25_INDEX_PATH
        
        # 延迟加载的组件
        self._chroma_client = None
        self._chroma_collection = None
        self._bm25_index = None
        self._bm25_spell_id_map = None
        self._embedding_model = None
        self._spells_dict = None  # spell_id -> SpellRecord
        self._vector_available = False
    
    def _ensure_loaded(self):
        """确保索引已加载"""
        if self._chroma_collection is None:
            try:
                self._load_chroma()
            except Exception as e:
                # 向量索引加载失败时允许降级到 BM25
                print(f"警告: Chroma 索引加载失败，降级为 BM25 检索: {e}")
        if self._bm25_index is None:
            self._load_bm25()
        # 仅当向量集合存在且有数据时才初始化 embedding，避免离线环境长时间阻塞。
        vector_collection_ready = False
        if self._chroma_collection is not None:
            try:
                vector_collection_ready = self._chroma_collection.count() > 0
            except Exception:
                vector_collection_ready = False

        if self._embedding_model is None and vector_collection_ready:
            try:
                print("加载 Embedding 模型...")
                self._embedding_model = create_embedding_client()
                self._vector_available = self._chroma_collection is not None
            except Exception as e:
                # 无法下载或加载 embedding 模型时，保持系统可用
                self._vector_available = False
                print(f"警告: Embedding 模型加载失败，降级为 BM25 检索: {e}")
        elif not vector_collection_ready:
            self._vector_available = False
        if self._spells_dict is None:
            self._load_spells()
    
    def _load_chroma(self):
        """加载 Chroma 向量索引"""
        if not self.chroma_dir.exists():
            raise FileNotFoundError(f"Chroma 索引目录不存在: {self.chroma_dir}")
        
        self._chroma_client = chromadb.PersistentClient(
            path=str(self.chroma_dir),
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        self._chroma_collection = self._chroma_client.get_collection("spells")
        print("Chroma 索引已加载")
    
    def _load_bm25(self):
        """加载 BM25 关键词索引"""
        if not self.bm25_path.exists():
            print(f"BM25 索引文件不存在，正在自动构建: {self.bm25_path}")
            spells = load_spells()
            documents = []
            spell_id_map = {}
            for idx, spell in enumerate(spells):
                search_text = build_search_text(spell.dict())
                tokens = list(jieba.cut(search_text))
                documents.append(tokens)
                spell_id_map[idx] = spell.spell_id
            bm25 = BM25Okapi(documents)
            index_data = {
                "bm25": bm25,
                "spell_id_map": spell_id_map,
                "documents": documents,
            }
            self.bm25_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.bm25_path, "wb") as f:
                pickle.dump(index_data, f)
            print(f"BM25 自动构建完成，共 {len(documents)} 个文档")
        
        with open(self.bm25_path, "rb") as f:
            index_data = pickle.load(f)
        
        self._bm25_index = index_data["bm25"]
        self._bm25_spell_id_map = index_data["spell_id_map"]
        print("BM25 索引已加载")
    
    def _load_spells(self):
        """加载法术数据到内存（用于聚合上下文）"""
        spells = load_spells()
        self._spells_dict = {spell.spell_id: spell for spell in spells}
        print(f"已加载 {len(self._spells_dict)} 条法术到内存")
    
    def search(
        self,
        question: str,
        top_k: int = 20,
        filters: Dict[str, Any] = None,
    ) -> List[Dict[str, Any]]:
        """执行混合检索
        
        Args:
            question: 用户问题
            top_k: 返回结果数量
            filters: 过滤条件 {'source': 'CRB', 'school': '防护', 'max_level': 3, 'spell_type': 'mythic'}
                max_level 按该法术任一职业可用的最低环位判断。
        
        Returns:
            检索结果列表，每个元素包含 spell_record, score, context_text
        """
        self._ensure_loaded()
        
        if filters is None:
            filters = {}
        
        start_time = time.time()
        
        # Step 1: Query 预处理
        clean_query, extracted_filters = self._preprocess_query(question, filters)
        
        # Step 2: 并行检索
        bm25_hits = self._bm25_search(clean_query, settings.BM25_TOP_K)
        vector_hits = []
        if self._vector_available:
            vector_hits = self._vector_search(clean_query, settings.VECTOR_TOP_K, extracted_filters)
        
        # Step 3: RRF 融合
        fused_hits = self._rrf_fusion(bm25_hits, vector_hits)
        
        # Step 4: Metadata 过滤
        filtered_hits = self._apply_filters(fused_hits, extracted_filters)
        
        # Step 5: 上下文聚合
        results = self._aggregate_context(filtered_hits[:top_k])
        
        latency_ms = int((time.time() - start_time) * 1000)
        print(f"检索完成: {len(results)} 个结果, 耗时 {latency_ms}ms")
        
        return results
    
    def _preprocess_query(self, question: str, filters: Dict) -> Tuple[str, Dict]:
        """预处理查询：提取过滤条件"""
        extracted = filters.copy()
        clean_query = question
        
        # 提取等级数字（如 "3环以下" -> max_level=3）
        level_match = re.search(r"(\d+)\s*环", question)
        if level_match and "max_level" not in extracted:
            extracted["max_level"] = int(level_match.group(1))
            clean_query = re.sub(r"\d+\s*环[以下上]?", "", clean_query)
        
        # 提取学派（简单匹配常见学派名）
        schools = ["防护", "塑能", "咒法", "预言", "惑控", "死灵", "变化", "幻术"]
        for school in schools:
            if school in question and "school" not in extracted:
                extracted["school"] = school
                clean_query = clean_query.replace(school, "")
                break

        if "spell_type" not in extracted:
            if "非神话" in question or "普通法术" in question:
                extracted["spell_type"] = "normal"
            elif "神话" in question:
                extracted["spell_type"] = "mythic"
        clean_query = clean_query.replace("普通法术", "").replace("非神话", "").replace("神话法术", "").replace("神话", "")
        
        return clean_query.strip(), extracted
    
    def _bm25_search(self, query: str, top_k: int) -> List[Tuple[str, float]]:
        """BM25 检索"""
        # 分词
        query_tokens = list(jieba.cut(query))
        
        # 计算分数
        scores = self._bm25_index.get_scores(query_tokens)
        
        # 获取 top_k
        top_indices = sorted(
            range(len(scores)),
            key=lambda i: scores[i],
            reverse=True
        )[:top_k]
        
        # 转换为 (spell_id, score) 列表
        hits = []
        for idx in top_indices:
            spell_id = self._bm25_spell_id_map[idx]
            score = float(scores[idx])
            hits.append((spell_id, score))
        
        return hits
    
    def _vector_search(
        self,
        query: str,
        top_k: int,
        filters: Dict
    ) -> List[Tuple[str, float]]:
        """向量检索"""
        # 生成查询向量
        query_embedding = self._embedding_model.encode([query])[0]
        
        # 构建 where 条件
        where_clause = {}
        if "source" in filters:
            where_clause["source"] = filters["source"]
        if "spell_type" in filters:
            where_clause["spell_type"] = filters["spell_type"]
        if "max_level" in filters:
            where_clause["min_level"] = {"$lte": filters["max_level"]}
        
        # 查询
        results = self._chroma_collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=top_k,
            where=where_clause if where_clause else None,
        )
        
        # 转换为 (spell_id, score) 列表
        hits = []
        if results["ids"] and len(results["ids"][0]) > 0:
            for i, spell_id_chunk in enumerate(results["ids"][0]):
                # 从 chunk_id 提取 spell_id
                # 例:
                # - "crb-0001-summary" -> "crb-0001"
                # - "crb-0001-effect" -> "crb-0001"
                # - "crb-0001-effect-0" -> "crb-0001"
                if spell_id_chunk.endswith("-summary"):
                    spell_id = spell_id_chunk[:-8]
                elif "-effect-" in spell_id_chunk:
                    spell_id = spell_id_chunk.split("-effect-")[0]
                elif spell_id_chunk.endswith("-effect"):
                    spell_id = spell_id_chunk[:-7]
                else:
                    spell_id = spell_id_chunk
                # Chroma 返回的是距离，转换为相似度分数（1 - distance）
                distance = results["distances"][0][i] if results["distances"] else 0
                score = float(1 - distance)  # 距离越小，相似度越高
                hits.append((spell_id, score))
        
        return hits
    
    def _rrf_fusion(
        self,
        bm25_hits: List[Tuple[str, float]],
        vector_hits: List[Tuple[str, float]],
    ) -> Dict[str, float]:
        """RRF (Reciprocal Rank Fusion) 融合"""
        k = 60  # RRF 参数
        fused_scores = {}
        
        # BM25 排名
        for rank, (spell_id, _) in enumerate(bm25_hits, start=1):
            fused_scores[spell_id] = fused_scores.get(spell_id, 0) + 1 / (k + rank)
        
        # Vector 排名
        for rank, (spell_id, _) in enumerate(vector_hits, start=1):
            fused_scores[spell_id] = fused_scores.get(spell_id, 0) + 1 / (k + rank)
        
        # 按分数排序
        sorted_spells = sorted(
            fused_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        return dict(sorted_spells)
    
    def _apply_filters(
        self,
        fused_scores: Dict[str, float],
        filters: Dict
    ) -> List[Tuple[str, float]]:
        """应用 metadata 过滤"""
        filtered = []
        
        for spell_id, score in fused_scores.items():
            if spell_id not in self._spells_dict:
                continue
            
            spell = self._spells_dict[spell_id]
            
            # 来源过滤
            if "source" in filters and spell.source != filters["source"]:
                continue

            if "spell_type" in filters and spell.spell_type != filters["spell_type"]:
                continue
            
            # 学派过滤
            if "school" in filters and filters["school"] not in spell.school:
                continue
            
            # 等级过滤：只要任一职业/列表可在 max_level 以内使用即可命中。
            if "max_level" in filters:
                max_level = filters["max_level"]
                spell_min = min([e["level"] for e in spell.level_by_class], default=999)
                if spell_min > max_level:
                    continue
            
            filtered.append((spell_id, score))
        
        return filtered
    
    def _aggregate_context(
        self,
        hits: List[Tuple[str, float]]
    ) -> List[Dict[str, Any]]:
        """聚合上下文：合并同一法术的多个 chunks"""
        results = []
        
        for spell_id, score in hits:
            if spell_id not in self._spells_dict:
                continue
            
            spell = self._spells_dict[spell_id]
            
            # 构建上下文文本（摘要 + 效果）
            context_parts = []
            
            # 摘要
            type_label = "神话法术" if spell.spell_type == "mythic" else "普通法术"
            summary = f"法术名称：{spell.name}\n法术类型：{type_label}\n学派：{spell.school}\n等级：{spell.level_raw}\n"
            summary += f"施法时间：{spell.cast_time}\n成分：{spell.components}\n"
            summary += f"范围：{spell.range}\n目标：{spell.target}\n"
            summary += f"持续：{spell.duration}\n豁免：{spell.save}\n法术抗力：{spell.spell_resistance}"
            context_parts.append(summary)
            
            # 效果
            if spell.effect:
                context_parts.append(f"效果：{spell.effect}")
            
            context_text = "\n\n".join(context_parts)
            
            results.append({
                "spell_record": spell,
                "score": score,
                "context_text": context_text,
            })
        
        return results
