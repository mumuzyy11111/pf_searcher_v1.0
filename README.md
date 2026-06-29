# PFSpellRAG v1.2.1

Pathfinder（PF）法术检索与智能问答系统。  
当前版本同时包含完整 RAG 运行形态和精简资料浏览/车卡器运行形态。

## 1. 项目能做什么

- 按法术名称检索
- 按关键词检索（全字段）
- 按职业/环位筛选法术
- 按学派筛选法术，并将神话法术作为独立分类
- 使用组合筛选页按职业、环位、学派、来源等条件检索法术
- 浏览 PF 常见状态规则与关键效果
- 浏览专长、职业、奇物资料
- 使用车卡器记录本地角色卡草稿，并从资料库加入职业、专长、法术、奇物
- 智能问答（RAG）：先检索再生成，返回带引用的回答
- LLM 不可用时自动降级为“仅检索候选结果”

## 2. 快速启动

### 2.1 安装依赖

```bash
pip install -r requirements.txt
```

### 2.2 配置 `.env`

项目根目录放置 `.env`，常用变量：

```env
LLM_API_KEY=your_api_key
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_MODEL=deepseek-ai/DeepSeek-V3.2

EMBEDDING_PROVIDER=siliconflow
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5
```

### 2.3 构建索引（首次或数据更新后建议执行）

```bash
python scripts/build/build_index.py
```

### 2.4 启动完整 RAG 服务

```bash
python run_web.py
```

启动后访问：

- 前端：`http://localhost:8000/web/`
- API 文档：`http://localhost:8000/docs`

### 2.5 启动精简版

```bash
python run_lite.py
```

精简版只保留前端展示、资料查询和车卡器，不加载 RAG、向量索引和 LLM 相关依赖。

## 3. 目录与各部分作用

### 3.1 运行入口

- `run_web.py`  
  启动 uvicorn，加载 FastAPI，并挂载 `web/` 和 `result/` 静态目录。

### 3.2 后端 API（`api/`）

- `api/main.py`：API 路由与应用入口
  - `GET /api/health`：健康检查
  - `GET /api/spell-sources`：返回法术数据源清单
  - `GET /api/spells/keyword`：关键词检索（全字段）
  - `POST /api/rag/search`：仅检索
  - `POST /api/rag/ask`：检索 + LLM 生成
- `api/config.py`：全局配置（路径、数据源发现、Embedding/LLM 参数）
- `api/models.py`：Pydantic 请求/响应模型（`SpellRecord`、RAG 请求响应等）
- `api/services/`
  - `data_loader.py`：读取 `result/*` JSON，统一不同 schema 到 `SpellRecord`
  - `indexer.py`：构建 Chroma 向量索引和 BM25 索引
  - `retriever.py`：混合检索（BM25 + 向量 + RRF 融合 + 过滤）
  - `embedding_client.py`：Embedding 适配层（本地模型或 OpenAI 兼容 API）
  - `generator.py`：LLM 生成与降级逻辑
- `api/utils/text_utils.py`：文本清洗、等级解析、字段纠偏、检索文本构建

### 3.3 前端（`web/`）

- `index.html`：页面结构（模式切换、筛选、结果区）
- `spells_filter.html`：组合式法术筛选页面，面向资料查询中的快速筛选。
- `conditions.html`：状态资料查询页面，读取 `assets/data/conditions.json`。
- `assets/js/spell-rag.js`：法术检索与 RAG 前端核心逻辑
  - 名称搜索 / 关键词搜索 / 职业搜索 / RAG 提问
  - API 调用与结果渲染（含 Markdown 表格渲染）
- `assets/js/spell-filter-core.js`、`assets/js/spell-filter.js`：组合筛选页的数据归一化、过滤与渲染逻辑。
- `assets/js/conditions.js`：状态查询页的搜索、分类筛选和详情渲染逻辑。
- `assets/css/spells.css`：法术页面样式
- `assets/css/spell-filter.css`、`assets/css/spell-view-switch.css`：组合筛选页样式。
- `assets/css/conditions.css`：状态查询页样式。
- `assets/css/browser.css`：专长/职业/奇物浏览页面通用样式

### 3.4 数据与索引

- `result/`：法术 JSON 数据（按来源书分目录）
- `data/chroma_db/`：向量索引持久化目录（Chroma）
- `data/bm25_index/index.pkl`：BM25 索引文件
- `data/aon_source_counts.json`：来源元数据（显示名、AoN 统计等）

### 3.5 脚本与评估（`scripts/`, `eval/`）

- `scripts/build/build_index.py`：离线构建索引入口
- `scripts/build/evaluate.py`：评估脚本（Retrieval@5、MRR、答案命中等）
- `eval/gold_set.json`：评估题集
- `scripts/extract_*.py` 等：数据抽取/清洗相关工具脚本（非日常运行必需）
- `tools/repair_content_integrity.py`：GitHub 更新引入的内容完整性修复工具，用于修复法术职业别名、法术等级重复项和专长文本串联污染。
- `Apply-Repair.ps1`：上述修复工具的 PowerShell 入口，默认 dry-run，传入 `-Apply` 后才写入修复结果。

### 3.6 打包与分发

- `packaging/legacy/PFSpellRAG.spec`：历史 PyInstaller 打包配置
- `scripts/package/package_lite.py`：精简分发版打包脚本
- `dist/PFSearcher_v1.2.1_portable.zip`：完整版本可分发便携包
- `dist/PFSearcherLite_v1.2.1_portable.zip`：精简版本可分发便携包
- `dist/PFSearcher_v1.2.1_portable/`、`dist/PFSearcherLite_v1.2.1_portable/`：便携运行目录（`exe + web + result + data`）

## 4. 核心流程（简化）

1. 前端提交问题到 `/api/rag/ask`
2. `HybridRetriever` 做 BM25 与向量检索并融合排序
3. 按来源/学派/环位/类型过滤
4. `LLMGenerator` 基于候选上下文生成回答并提取引用
5. 若 LLM 失败，返回降级候选结果

## 5. 常见维护操作

- 更新 `result/` 数据后：重新执行 `python scripts/build/build_index.py`
- 检查法术/专长内容污染：先执行 `.\Apply-Repair.ps1` 生成 dry-run 审计报告，确认后再执行 `.\Apply-Repair.ps1 -Apply`
- 更换模型/API：修改 `.env` 中 LLM 与 Embedding 相关变量
- 验证服务：访问 `/api/health`

## 6. 注意事项

- 首次加载或首次构建索引耗时会较长（模型加载/向量化）
- 未配置 `LLM_API_KEY` 时，问答接口会进入降级模式（仍可检索）
- `build/`、`dist/`、`__pycache__/` 属于构建产物，不是核心源码

## 7. 更新说明

完整更新记录见 `CHANGELOG.md` 和 `docs/更新文档.md`。当前版本为 `v1.2.1`。
