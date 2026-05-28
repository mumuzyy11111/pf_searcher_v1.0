# PF 法术 RAG 系统使用指南

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

确保 `.env` 文件存在并包含正确的 API Key：

```
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_MODEL=deepseek-ai/DeepSeek-V3.2
```

### 3. 构建索引

首次使用前需要构建索引：

```bash
python scripts/build_index.py
```

这将：
- 自动扫描并加载 `result/` 下的法术数据源
- 构建 Chroma 向量索引（~3500+ chunks）
- 构建 BM25 关键词索引
- 索引文件保存在 `data/` 目录

### 4. 启动服务

```bash
python run_web.py
```

服务将：
- 启动 FastAPI 后端（端口 8000）
- 提供静态文件服务（web/ 和 result/）
- 自动打开浏览器到 `http://localhost:8000/web/`

### 5. 使用系统

在浏览器中：
1. **按名称搜索**：输入法术名称进行子串匹配
2. **按职业筛选**：选择职业和等级查看法术列表
3. **智能问答**：输入自然语言问题，获得 AI 生成的回答和引用

## API 端点

- `GET /api/health` - 健康检查
- `POST /api/rag/search` - 仅检索（不生成）
- `POST /api/rag/ask` - 检索 + LLM 生成

API 文档：`http://localhost:8000/docs`

## 评估

运行评估脚本：

```bash
python scripts/evaluate.py
```

将输出：
- Retrieval@5（检索质量）
- MRR（排序质量）
- 答案准确率
- 延迟统计

## 目录结构

```
PF_RAG/
├── api/                    # 后端 API
│   ├── main.py            # FastAPI 路由
│   ├── config.py          # 配置管理
│   ├── models.py          # 数据模型
│   ├── services/          # 业务逻辑
│   │   ├── data_loader.py # 数据加载
│   │   ├── indexer.py     # 索引构建
│   │   ├── retriever.py   # 混合检索
│   │   └── generator.py   # LLM 生成
│   └── utils/             # 工具函数
├── data/                  # 索引持久化
│   ├── chroma_db/        # 向量索引
│   └── bm25_index/       # BM25 索引
├── eval/                  # 评估集
│   └── gold_set.json
├── scripts/              # 脚本
│   ├── build_index.py    # 构建索引
│   └── evaluate.py       # 评估
├── web/                  # 前端
│   ├── index.html
│   ├── script.js
│   └── style.css
├── result/               # 法术数据（只读）
└── run_web.py           # 启动入口
```

## 注意事项

1. **首次启动**：需要先运行 `build_index.py` 构建索引
2. **API Key**：确保 `.env` 中的 API Key 有效
3. **数据更新**：如果 `result/` 下的 JSON 文件更新，需要重新构建索引
4. **性能**：首次加载 Embedding 模型可能需要 10-20 秒

## 故障排除

- **索引不存在**：运行 `python scripts/build_index.py`
- **API 调用失败**：检查 `.env` 中的 API Key 和网络连接
- **前端无法访问**：确保在项目根目录运行 `run_web.py`
