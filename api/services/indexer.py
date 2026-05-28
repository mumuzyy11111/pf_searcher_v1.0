"""索引构建模块"""
from __future__ import annotations

import pickle
from pathlib import Path
from typing import Dict, List

import chromadb
from chromadb.config import Settings as ChromaSettings
from rank_bm25 import BM25Okapi
import jieba

from api.config import settings
from api.models import SpellRecord
from api.services.data_loader import load_spells
from api.services.embedding_client import create_embedding_client
from api.utils.text_utils import build_search_text


class Indexer:
    """索引构建器"""
    
    def __init__(self):
        self.project_root = settings.PROJECT_ROOT
        self.chroma_dir = self.project_root / settings.CHROMA_PERSIST_DIR
        self.bm25_path = self.project_root / settings.BM25_INDEX_PATH
        
        # 确保目录存在
        self.chroma_dir.mkdir(parents=True, exist_ok=True)
        self.bm25_path.parent.mkdir(parents=True, exist_ok=True)
    
    def build_all(self) -> Dict[str, int]:
        """构建所有索引
        
        Returns:
            统计信息：{'spell_count': ..., 'chunk_count': ..., 'bm25_doc_count': ...}
        """
        print("开始加载法术数据...")
        spells = load_spells()
        print(f"已加载 {len(spells)} 条法术")
        
        # 构建向量索引
        print("构建 Chroma 向量索引...")
        chunk_count = self._build_chroma_index(spells)
        
        # 构建 BM25 索引
        print("构建 BM25 关键词索引...")
        bm25_doc_count = self._build_bm25_index(spells)
        
        stats = {
            "spell_count": len(spells),
            "chunk_count": chunk_count,
            "bm25_doc_count": bm25_doc_count,
        }
        
        print(f"索引构建完成: {stats}")
        return stats
    
    def _build_chroma_index(self, spells: List[SpellRecord]) -> int:
        """构建 Chroma 向量索引"""
        # 初始化 Chroma 客户端
        client = chromadb.PersistentClient(
            path=str(self.chroma_dir),
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        
        # 获取或创建集合
        collection = client.get_or_create_collection(
            name="spells",
            metadata={"description": "PF 法术向量索引"}
        )
        
        # 清空现有数据（重建索引）。不同 embedding 维度不能复用旧集合。
        try:
            client.delete_collection("spells")
        except Exception:
            pass
        collection = client.create_collection(
            name="spells",
            metadata={"description": "PF 法术向量索引"}
        )
        
        # 准备数据
        documents = []
        metadatas = []
        ids = []
        
        chunk_idx = 0
        for spell in spells:
            # Chunk 1: 摘要块（关键字段）
            summary_text = self._build_summary_chunk(spell)
            documents.append(summary_text)
            metadatas.append({
                "spell_id": spell.spell_id,
                "source": spell.source,
                "spell_type": spell.spell_type,
                "school": spell.school,
                "min_level": min([e["level"] for e in spell.level_by_class], default=0),
                "max_level": max([e["level"] for e in spell.level_by_class], default=0),
                "chunk_type": "summary",
            })
            ids.append(f"{spell.spell_id}-summary")
            chunk_idx += 1
            
            # Chunk 2: 效果块（效果描述）
            if spell.effect:
                # 如果效果文本过长（>500字），按段落拆分
                if len(spell.effect) > 500:
                    effect_chunks = self._split_effect_text(spell.effect)
                    for i, chunk_text in enumerate(effect_chunks):
                        documents.append(chunk_text)
                        metadatas.append({
                            "spell_id": spell.spell_id,
                            "source": spell.source,
                            "spell_type": spell.spell_type,
                            "school": spell.school,
                            "min_level": min([e["level"] for e in spell.level_by_class], default=0),
                            "max_level": max([e["level"] for e in spell.level_by_class], default=0),
                            "chunk_type": "effect",
                            "chunk_index": i,
                        })
                        ids.append(f"{spell.spell_id}-effect-{i}")
                        chunk_idx += 1
                else:
                    documents.append(spell.effect)
                    metadatas.append({
                        "spell_id": spell.spell_id,
                        "source": spell.source,
                        "spell_type": spell.spell_type,
                        "school": spell.school,
                        "min_level": min([e["level"] for e in spell.level_by_class], default=0),
                        "max_level": max([e["level"] for e in spell.level_by_class], default=0),
                        "chunk_type": "effect",
                    })
                    ids.append(f"{spell.spell_id}-effect")
                    chunk_idx += 1
        
        model = create_embedding_client()
        
        print(f"生成 {len(documents)} 个 chunk 的向量...")
        embeddings = model.encode(documents, show_progress_bar=True)
        
        # 添加到 Chroma
        collection.add(
            embeddings=embeddings.tolist(),
            documents=documents,
            metadatas=metadatas,
            ids=ids,
        )
        
        print(f"Chroma 索引构建完成，共 {chunk_idx} 个 chunks")
        return chunk_idx
    
    def _build_bm25_index(self, spells: List[SpellRecord]) -> int:
        """构建 BM25 关键词索引"""
        # 准备文档列表（每个法术一个文档）
        documents = []
        spell_id_map = {}  # 索引位置 -> spell_id
        
        for idx, spell in enumerate(spells):
            # 构建全文检索文本
            search_text = build_search_text(spell.dict())
            # 使用 jieba 分词
            tokens = list(jieba.cut(search_text))
            documents.append(tokens)
            spell_id_map[idx] = spell.spell_id
        
        # 构建 BM25 索引
        bm25 = BM25Okapi(documents)
        
        # 保存索引和映射
        index_data = {
            "bm25": bm25,
            "spell_id_map": spell_id_map,
            "documents": documents,  # 保存原始文档用于调试
        }
        
        with open(self.bm25_path, "wb") as f:
            pickle.dump(index_data, f)
        
        print(f"BM25 索引构建完成，共 {len(documents)} 个文档")
        return len(documents)
    
    def _build_summary_chunk(self, spell: SpellRecord) -> str:
        """构建摘要块文本"""
        parts = [
            f"法术名称：{spell.name}",
            f"法术类型：{'神话法术' if spell.spell_type == 'mythic' else '普通法术'}",
            f"学派：{spell.school}",
            f"等级：{spell.level_raw}",
            f"施法时间：{spell.cast_time}",
            f"成分：{spell.components}",
            f"范围：{spell.range}",
            f"目标：{spell.target}",
            f"持续：{spell.duration}",
            f"豁免：{spell.save}",
            f"法术抗力：{spell.spell_resistance}",
        ]
        return "\n".join(filter(None, parts))
    
    def _split_effect_text(self, text: str, max_length: int = 500) -> List[str]:
        """按段落拆分效果文本"""
        # 按句号、换行等分割
        import re
        sentences = re.split(r"[。\n]", text)
        
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            if len(current_chunk) + len(sentence) + 1 <= max_length:
                current_chunk += sentence + "。"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + "。"
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks if chunks else [text]
