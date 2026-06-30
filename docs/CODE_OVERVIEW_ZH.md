# PF_RAG 代码结构与功能说明

本文档说明当前 PF_RAG 项目的主要代码组成、各部分职责，以及目前已经完成的功能。项目当前同时包含完整 RAG 运行版和精简分发版。

## 1. 项目整体定位

PF_RAG 是一个 Pathfinder 资料本地检索与浏览工具。当前数据主要来自已提取和清洗后的 JSON 文件，前端负责展示与查询，后端负责提供静态资源、数据源发现、关键词查询，以及完整版本中的 RAG 检索与问答能力。

当前主要能力包括：

- 法术浏览与检索。
- 按职业和环位查看法术。
- 全字段关键词搜索法术。
- 专长浏览、筛选与详情查看。
- 职业、进阶职业、神话道途、变体和职业能力浏览。
- 奇物资料浏览。
- 本地自动车卡工作台。
- 完整版支持 RAG 检索与智能问答。
- 精简版支持本地前端展示和查询，去除了提取脚本、CHM 原始文件、索引和大模型相关依赖。

## 2. 运行入口

## 2A. 根目录整理结果

根目录当前只保留项目运行和开发最常用的入口与元文件：

- `.env`：本地环境变量和 API Key，不提交。
- `.gitignore`：Git 忽略规则。
- `README.md`：项目主说明。
- `requirements.txt`：完整版本 Python 依赖。
- `run_web.py`：完整 RAG 版本启动入口。
- `run_lite.py`：精简版启动入口。

已从根目录移出的内容：

- `Pathfinder v2.14 SC.chm`、`Pathfinder v2.14 SC.chw` -> `assets/raw/`
- `spell/` -> `assets/raw/spell/`
- 未归类图片 -> `assets/misc/`
- CHM 转换工具 -> `tools/chm/`
- 法术导出工具 -> `tools/export/`
- 历史 PyInstaller spec -> `packaging/legacy/`
- `README_RAG.md` -> `docs/README_RAG.md`

已清理内容：

- `_frontend*.log`
- 空的 `_chm_decompiled/`、`_chm_extract/`
- `build/`
- `__pycache__/`

### `run_web.py`

完整运行入口。

职责：

- 启动 FastAPI 应用。
- 挂载 `web/` 为 `/web` 静态页面。
- 挂载 `result/` 为 `/result` 数据目录。
- 自动寻找可用端口，优先使用 `8000`。
- 启动后自动打开浏览器。
- 使用 `api.main:app`，因此包含完整 API、RAG 检索和智能问答能力。

适用场景：

- 开发调试。
- 本地完整 RAG 版本。
- 需要 `/api/rag/search` 或 `/api/rag/ask` 的场景。

### `run_lite.py`

精简分发版运行入口。

职责：

- 启动一个轻量 FastAPI 应用。
- 挂载 `web/` 和 `result/`。
- 提供前端需要的基础 API：
  - `/api/health`
  - `/api/spell-sources`
  - `/api/spells/keyword`
- 不导入 `chromadb`、`openai`、`sentence_transformers`、BM25 等重依赖。
- 用于生成体积更小的可分发包。

适用场景：

- 只需要前端展示、法术关键词查询、专长/职业/奇物浏览。
- 给普通用户分发，不需要安装 Python 环境。
- 不需要智能问答和向量检索。

## 3. 后端 API 代码

后端代码位于 `api/`。

## 3A. 可复用运行时包

可复用运行时包位于 `pf_rag/runtime/`。这部分是本次整理后抽出来的公共能力，目标是让完整入口、精简入口和后续测试/工具脚本共享同一套基础逻辑。

### `pf_rag/runtime/paths.py`

职责：

- 统一处理源码运行和 PyInstaller 打包运行时的根目录解析。
- 提供 `RuntimePaths`，集中管理：
  - `base_dir`
  - `web_dir`
  - `result_dir`
  - `data_dir`

复用价值：

- `run_web.py` 和 `run_lite.py` 不再各自实现路径判断。
- 后续其他入口或测试可以直接使用同一套路径对象。

### `pf_rag/runtime/server.py`

职责：

- 查找可用端口。
- 根据命令行参数判断是否自动打开浏览器。
- 封装浏览器打开逻辑。

复用价值：

- 完整版和精简版共用端口选择逻辑。
- `--no-browser` 调试参数行为集中管理。

### `pf_rag/runtime/spell_catalog.py`

职责：

- 发现 `result/` 下的法术数据源。
- 读取来源书元数据。
- 统计法术数量。
- 加载单个来源的法术记录。
- 提供轻量关键词搜索。

复用价值：

- 精简版 API 不再直接操作 JSON 文件细节。
- 后续如果要加入 SQLite 或轻量索引，可以在这里替换实现，前端 API 不需要跟着大改。

### `pf_rag/runtime/lite_app.py`

职责：

- 创建精简版 FastAPI 应用。
- 注册精简版 API：
  - `/api/health`
  - `/api/spell-sources`
  - `/api/spells/keyword`
- 挂载 `web/` 和 `result/` 静态目录。

复用价值：

- `run_lite.py` 现在只是启动入口。
- 测试时可以直接导入 `create_lite_app()` 创建应用，不必启动真实 exe。

### `api/main.py`

完整 FastAPI 应用组装文件。

职责：

- 创建 `FastAPI` app。
- 注册 `api/routers/health.py`、`api/routers/spells.py`、`api/routers/rag.py`。
- 不再直接承载具体业务逻辑，避免入口文件持续膨胀。

### `api/dependencies.py`

完整 API 的依赖加载模块。

职责：

- 延迟加载并缓存 `HybridRetriever`。
- 延迟加载并缓存 `LLMGenerator`。
- 维护索引构建时间和法术数量状态。
- 在索引无法加载时返回明确错误。

这部分原先混在 `api/main.py` 中，现在独立出来，便于路由和后续测试复用。

### `api/routers/`

完整 API 的路由目录。

#### `api/routers/health.py`

提供：

- `GET /api/health`

职责：

- 检查完整 RAG 检索器是否能加载。
- 返回服务状态、版本、法术数量和索引时间。

#### `api/routers/spells.py`

提供：

- `GET /api/spell-sources`
- `GET /api/spells/keyword`

职责：

- 返回前端可加载的数据源列表。
- 提供跨法术 JSON 全字段关键词检索。

#### `api/routers/rag.py`

主要接口：

- `POST /api/rag/search`：只做 RAG 检索，不调用 LLM。
- `POST /api/rag/ask`：先检索，再调用 LLM 生成回答。

职责：

- 调用 `HybridRetriever` 做混合检索。
- 调用 `LLMGenerator` 做智能问答。
- 智能问答要求前端请求中传入 API Key，不把用户 Key 固化到包内。

### `api/services/spell_sources.py`

法术数据源服务。

职责：

- 统计单个法术 JSON 文件数量。
- 构建 `/api/spell-sources` 所需的数据源摘要。
- 提供完整 API 版本的全字段关键词检索。

这部分原先也在 `api/main.py` 中，现在单独作为服务模块，后续如果要换成 SQLite 或轻量索引，可以优先改这里。

### `api/config.py`

全局配置模块。

职责：

- 解析项目根目录。
- 从 `.env` 和 `config/app.env` 加载配置。
- 自动发现 `result/*/spells-*.json` 数据源。
- 加载 `data/aon_source_counts.json` 中的来源元数据。
- 配置 Chroma、BM25、Embedding、LLM 参数。

重点配置：

- `SPELL_SOURCES`：自动发现的法术数据文件。
- `CHROMA_PERSIST_DIR`：向量索引目录。
- `BM25_INDEX_PATH`：BM25 索引文件。
- `LLM_BASE_URL`、`LLM_MODEL`、`LLM_TIMEOUT`：LLM 调用配置。
- `EMBEDDING_PROVIDER`、`EMBEDDING_MODEL`：Embedding 配置。

### `api/models.py`

Pydantic 数据模型。

主要模型：

- `SpellRecord`：统一后的法术记录结构。
- `RagSearchRequest` / `RagSearchResponse`：RAG 检索请求与响应。
- `RagAskRequest` / `RagAskResponse`：智能问答请求与响应。
- `Citation`：回答引用信息。
- `HealthResponse`：健康检查响应。

作用：

- 统一后端内部数据结构。
- 给 FastAPI 自动生成接口文档。
- 约束请求和响应字段。

## 4. 后端服务层

服务层位于 `api/services/`。

### `data_loader.py`

法术数据加载与清洗模块。

职责：

- 读取 `result/` 下发现的法术 JSON。
- 兼容旧格式和模型格式两种 schema。
- 把不同来源字段统一成 `SpellRecord`。
- 清洗被污染字段，例如等级、范围、目标、持续时间、法术抗力等字段中混入正文的情况。
- 解析职业环位结构 `level_by_class`。

当前作用：

- 是完整 RAG 索引构建和检索的基础。
- 支持普通法术和神话法术类型识别。

### `indexer.py`

索引构建模块。

职责：

- 加载全部法术记录。
- 构建 Chroma 向量索引。
- 构建 BM25 关键词索引。
- 把索引持久化到 `data/chroma_db/` 和 `data/bm25_index/index.pkl`。

索引内容：

- 每个法术会生成摘要 chunk。
- 法术效果较长时会拆成多个 effect chunk。
- Chroma metadata 中保存来源、学派、类型、最低/最高环位等字段。

适用场景：

- 完整 RAG 版本。
- 数据更新后重新构建索引。

### `retriever.py`

混合检索模块。

职责：

- 延迟加载 Chroma、BM25 和法术数据。
- 查询预处理，自动识别部分过滤条件，例如环位、学派、神话/普通法术。
- 同时执行 BM25 检索和向量检索。
- 使用 RRF 融合两个检索结果。
- 按来源、学派、法术类型、最高环位过滤。
- 聚合同一法术的上下文，返回给 API 或 LLM。

降级逻辑：

- 如果 Chroma 或 Embedding 不可用，允许降级为 BM25 检索。
- 这保证了完整版本在缺少向量能力时仍能基本查询。

### `embedding_client.py`

Embedding 适配层。

职责：

- 支持 OpenAI 兼容接口生成向量。
- 支持本地 `sentence-transformers` 模型。
- 批量编码文本。
- 根据配置控制 batch size 和输入截断长度。

使用场景：

- 构建 Chroma 向量索引。
- RAG 检索时编码用户问题。

### `generator.py`

LLM 回答生成模块。

职责：

- 构造 Pathfinder 法术问答系统提示词。
- 使用检索结果作为上下文。
- 调用 OpenAI 兼容 Chat Completions 接口。
- 从回答中提取引用法术。
- LLM 失败或超时时降级为检索结果列表。

当前策略：

- 要求回答基于检索结果，不编造。
- 条件检索类问题要求逐一判断候选是否满足条件。
- 对比类问题要求使用 Markdown 表格。

## 5. 后端工具函数

### `api/utils/text_utils.py`

文本清洗和解析工具。

主要功能：

- `clean_text`：统一空白字符。
- `split_name`：拆分中英文法术名。
- `split_polluted_field`：从短字段中拆出误混入的正文。
- `split_spell_resistance_text`：处理法术抗力字段污染。
- `recover_level_from_effect`：从效果正文开头恢复被切走的等级字段。
- `parse_level_entries`：把等级文本解析为职业与环位列表。
- `canonicalize_profession`：规范职业名。
- `build_search_text`：为 BM25 构建全文检索文本。
- `extract_source_from_path`：从路径提取来源书缩写。

作用：

- 保证不同来源、不同格式的法术数据能被统一检索。

## 6. 前端页面

前端位于 `web/`，是静态 HTML/CSS/JS。

### `web/index.html`

总入口页面。

功能：

- 提供顶部页签。
- 使用 iframe 嵌入各功能页：
  - 法术
  - 专长
  - 职业
  - 奇物
  - 自动车卡

### `web/spells.html` + `web/assets/js/spell-rag.js`

法术检索页面。

主要功能：

- 按名称搜索法术。
- 按关键词搜索全部字段。
- 按职业和环位浏览法术。
- 完整版支持智能问答模式。
- 从 `/api/spell-sources` 自动获取数据源列表。
- 从 `/api/spells/keyword` 获取后端关键词搜索结果。
- 前端本地解析职业环位并构建职业索引。

精简版差异：

- 打包时会把默认模式改为“按名称”。
- 仍保留名称、关键词、职业和环位查询。
- 不提供实际 RAG 智能问答能力。

### `web/feats.html` + `web/assets/js/feats.js`

专长检索页面。

数据源：

- `result/feats/feats-frontend.json`

主要功能：

- 加载专长前端数据。
- 按名称或关键词检索。
- 按专长类型筛选，例如战斗、超魔、造物、团队、故事、神话等。
- 按来源书筛选。
- 展示先决条件、效果简述、详述、故事专长字段和附表。

### `web/classes.html` + `web/assets/js/classes.js`

职业资料页面。

数据源：

- `result/classes/classes-extracted.json`

主要功能：

- 浏览基础职业、进阶职业、神话道途。
- 查看职业总览、等级表、核心职业能力、可选能力、天赋职业奖励、职业变体。
- 支持职业搜索。
- 支持职业能力和附表展示。

### `web/items.html` + `web/assets/js/items.js`

奇物资料页面。

数据源：

- `result/items/wondrous-items.json`

主要功能：

- 浏览奇物。
- 按装备部位分组。
- 搜索物品名称、价格、来源、效果等字段。
- 展示价格、灵光、施法者等级、重量、制造条件、成本、详情等。
- 对部分艾恩石等聚合条目做前端合并展示。

### `web/character.html` + `web/assets/js/character.js` + `web/assets/css/character.css`

自动车卡工作台。

主要功能：

- 本地保存角色信息。
- 编辑基础信息和属性。
- 从职业、专长、法术、物品资料中选择并加入角色记录。
- 提供简单校验和导出区域。
- 使用浏览器本地存储，不依赖后端数据库。

### `web/assets/`

前端静态资源目录。

职责：

- `assets/css/index.css`：总入口样式。
- `assets/css/spells.css`：法术页面、检索结果、RAG 面板、职业模式布局等样式。
- `assets/css/browser.css`：专长/职业/奇物浏览页通用样式。
- `assets/css/character.css`：自动车卡样式。
- `assets/js/index.js`：总入口页签切换。
- `assets/js/spell-rag.js`：法术检索和 RAG 主逻辑。
- `assets/js/spells-simple.js`：旧的简化法术浏览脚本，当前未接入页面。
- `assets/js/feats.js`、`classes.js`、`items.js`、`character.js`：各页面业务逻辑。

当前整理原则：

- HTML 继续保留在 `web/` 根层，保持 `/web/spells.html` 等旧访问路径不变。
- CSS/JS 统一收敛到 `web/assets/`。
- 不再新增 `script.js` 这类含糊命名。

## 7. 数据目录

### `result/`

运行时主要数据目录。

主要内容：

- `result/<source>/spells-<source>.json`：法术原始或清洗后数据。
- `result/<source>/spells-<source>-model.json`：模型格式法术数据。
- `result/feats/feats-frontend.json`：前端使用的专长数据。
- `result/classes/classes-extracted.json`：职业和变体数据。
- `result/items/wondrous-items.json`：奇物数据。

当前规模：

- 精简运行版发现约 100 个法术来源。
- 法术记录约 3104 条。
- 专长前端数据约 1649 条。
- 职业/路径数据约 171 条，变体约 579 条。
- 奇物数据约 1140 条。

### `data/`

索引和元数据目录。

主要内容：

- `data/aon_source_counts.json`：来源书元数据和 AoN 数量信息。
- `data/chroma_db/`：完整版向量索引。
- `data/bm25_index/`：完整版 BM25 索引。

精简版只复制少量来源元数据，不复制 Chroma 和 BM25 索引。

## 8. 工具与脚本目录

### 根目录整理后的工具位置

当前根目录只保留运行入口、README、依赖清单和项目元文件。非运行时文件已归类：

- `assets/raw/`：原始 CHM/CHW 资料文件。
- `assets/misc/`：未归类的图片等杂项资源。
- `tools/chm/`：CHM 转换工具。
- `tools/export/`：法术导出工具。
- `packaging/legacy/`：历史 PyInstaller spec 文件。

这些内容不属于精简运行时主路径，避免继续堆在项目根目录。

脚本位于 `scripts/`。这些脚本主要用于数据提取、清洗、修复、审计和打包，精简分发版不会包含这些脚本。

当前整理状态：

- 正式脚本已按职责移动到 `scripts/analysis/`、`scripts/backfill/`、`scripts/books/`、`scripts/build/`、`scripts/config/`、`scripts/extract/`、`scripts/fix/`、`scripts/localize/`、`scripts/locate/`、`scripts/package/`。
- 临时 `_..._tmp.py` 脚本已归档到 `scripts/_scratch/`。
- 旧的 `APG_spell_extract.py` 已统一为 `scripts/extract/extract_spells_apg.py`。
- 旧的 `OA_spell_extract.py` 已统一为 `scripts/extract/extract_spells_oa.py`。
- `scripts/README.md` 记录了脚本分类、命名规则和运行方式。

### 索引与评估

- `build_index.py`：构建完整 RAG 所需 Chroma 和 BM25 索引。
- `evaluate.py`：基于评估集测试检索质量和回答命中情况。

### 法术提取与修复

代表脚本：

- `extract_spells.py`
- `extract_spells_html.py`
- `extract_spells_step1.py`
- `batch_extract_spell_html.py`
- `auto_fix_source_spell_names.py`
- `fix_level_parse_fails.py`

职责：

- 从 HTML/CHM/来源文件中提取法术。
- 修复法术名、等级、字段污染等问题。
- 输出到 `result/<source>/`。

### 专长提取与回填

代表脚本：

- `extract_feats_and_verify.py`
- `build_feats_frontend_json.py`
- `backfill_feat_detail_from_chm_rich_feat_pages.py`
- `backfill_feat_detail_from_aon.py`
- `backfill_feat_detail_unified.py`
- `fix_feat_detail_contamination.py`
- `repair_feat_names_from_source_tables.py`

职责：

- 从 CHM 嵌入页面和 AoN 中提取专长名。
- 比对 CHM 与 AoN 覆盖率。
- 回填先决条件、效果简述、详述、故事专长字段。
- 修复专长名错误、详情污染、短详情等问题。
- 生成 `result/feats/feats-frontend.json`。

### 当前打开的脚本

`scripts/backfill/backfill_feat_detail_from_chm_rich_feat_pages.py`

功能：

- 读取 `result/feats/feat-book-feats.json`。
- 读取 `result/Pathfinder-v2.14-SC-viewer-embedded.html`。
- 从富文本 CHM 专长页中识别专长标题、先决条件、效果、描述文本。
- 按英文名生成 `match_key`。
- 用更完整的 CHM 内容回填：
  - `prerequisites`
  - `benefit_summary`
  - `detail_text`
- 默认输出到 `result/feats/feat-book-feats-rich-pages.json`。
- 使用 `--inplace` 时覆盖输入文件。
- 使用 `--keys` 时只处理指定 `match_key`。

### 职业和奇物提取

代表脚本：

- `extract_classes.py`
- `build_class_profile_hierarchy.py`
- `extract_class_special_abilities.py`
- `extract_wondrous_items.py`

职责：

- 提取职业、进阶职业、神话道途。
- 提取职业能力、可选能力、变体能力和附表。
- 提取奇物条目、部位、价格、制造条件和详情。

### 打包脚本

- `package_portable.py`：完整版本打包脚本，包含完整后端和 RAG 相关依赖。
- `package_lite.py`：精简版本打包脚本，只保留前端展示和轻量查询。

`package_lite.py` 当前完成内容：

- 使用 PyInstaller 构建 `pathfinder_tools_lite.exe`。
- 复制 `web/`。
- 复制运行时需要的法术、专长、职业、奇物 JSON。
- 复制 `data/aon_source_counts.json`。
- 不复制 `scripts/`、CHM 原始文件、Chroma 索引、BM25 索引。
- 生成：
  - `start.bat`
  - `install.bat`
  - `README_中文.txt`
  - `dist/pathfinder_tools_lite_v1.2.2_portable.zip`

## 9. 打包与分发

### 完整版本

相关文件：

- `packaging/legacy/*.spec`：旧版历史配置
- `scripts/package/package_portable.py`

特点：

- 包含完整 FastAPI 后端。
- 包含 RAG 检索所需依赖。
- 可以使用智能问答。
- 体积较大。

### 精简版本

相关文件：

- `run_lite.py`
- `scripts/package/package_lite.py`
- `dist/pathfinder_tools_lite_v1.2.2_portable.zip`

特点：

- 面向普通用户分发。
- 解压后可直接运行。
- 可通过 `install.bat` 安装到用户目录并创建桌面快捷方式。
- 不要求用户安装 Python。
- 不包含数据提取工具和智能问答依赖。
- 当前压缩包约 43 MB，解压后约 98 MB。

## 10. 当前已经完成的功能

### 已完成：数据展示与检索

- 法术数据可加载和展示。
- 支持法术名称搜索。
- 支持法术全字段关键词搜索。
- 支持按职业和环位查看法术。
- 支持专长名称、关键词、类型、来源书筛选。
- 支持职业、职业能力、变体和附表浏览。
- 支持奇物资料浏览。
- 支持本地自动车卡工作台。

### 已完成：完整 RAG 后端

- 支持法术数据统一加载。
- 支持 BM25 索引构建。
- 支持 Chroma 向量索引构建。
- 支持 BM25 + 向量混合检索。
- 支持 RRF 融合排序。
- 支持按来源、学派、类型、环位过滤。
- 支持调用 OpenAI 兼容 LLM 生成回答。
- 支持 LLM 失败时降级为检索结果。

### 已完成：数据清洗和构建脚本

- 法术提取、字段修复和索引构建脚本。
- 专长提取、覆盖率比对、详情回填、污染修复脚本。
- 职业和奇物提取脚本。
- 前端专长 JSON 构建脚本。

### 已完成：精简分发包

- 已新增轻量入口 `run_lite.py`。
- 已新增精简打包脚本 `scripts/package/package_lite.py`。
- 当前精简版目标产物为 `dist/pathfinder_tools_lite_v1.2.2_portable.zip`。
- 已生成中文说明文件 `README_中文.txt`。
- 已验证精简版 exe 能启动本地服务。
- 已验证 `/api/health`、`/api/spell-sources`、`/api/spells/keyword` 正常响应。

## 11. 当前限制和后续可改进点

当前限制：

- 精简版不支持智能问答。
- 精简版不包含向量检索和 BM25 索引。
- 精简版关键词搜索是直接扫描 JSON，数据量继续增大后可能需要轻量索引。
- 前端部分旧法术文本仍有编码兼容逻辑，说明历史数据来源存在编码混杂问题。
- 完整 RAG 版本依赖外部 API Key 或本地模型配置。

后续可改进：

- 为精简版加入更轻量的浏览器端或本地 SQLite 索引。
- 给分发版加入版本号和构建日期。
- 给 exe 增加图标和无控制台窗口模式。
- 将完整 RAG 版和 Lite 版配置进一步拆分。
- 为数据质量报告增加统一入口页面。
- 为打包脚本增加自动 smoke test。
