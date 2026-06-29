# PF_RAG 代码系统整理说明

本文档按用途把当前项目拆成 4 个层次：可分发应用、规则解析工具、RAG/前端主程序、数据与数据结构。当前仓库仍保持原目录不移动，避免破坏已经可运行的便携版本。

## 1. 便于打包的完整应用程序

这一层负责把已经构建好的前端、后端、索引和法术数据打包成可分发程序。

### 运行入口

- `run_web.py`
  - FastAPI 启动入口。
  - 挂载 `web/` 前端页面。
  - 挂载 `result/` 法术 JSON 静态数据。
  - 自动寻找可用端口并打开浏览器。

### 打包脚本与配置

- `scripts/package/package_portable.py`
  - 使用 PyInstaller 打包 `pathfinder_tools.exe`。
  - 复制 `web/`、`result/`、`data/chroma_db/`、`data/bm25_index/`。
  - 生成 `dist/pathfinder_tools_v1.2.2_portable/` 和 `dist/pathfinder_tools_v1.2.2_portable.zip`。
  - 当前已收集 `chromadb`、`posthog`、`pypika`、`onnxruntime`、`tokenizers`，用于修复便携版 Chroma 加载问题。

- `packaging/legacy/*.spec`
  - PyInstaller spec 文件。
  - 历史打包配置。当前项目发布名已改为 `pathfinder_tools_v1.2.2`，新打包流程以 `scripts/package/package_portable.py` 为准。

- `run_web.spec`
  - 旧的/备用打包配置。
  - 当前主要分发应以 `scripts/package/package_portable.py` 为准，历史 spec 仅作旧版参考。

### 打包产物

- `dist/pathfinder_tools_v1.2.2_portable/`
  - 当前可运行便携目录。
  - 包含 `pathfinder_tools.exe`、`start.bat`、`web/`、`result/`、`data/`。

- `dist/pathfinder_tools_v1.2.2_portable.zip`
  - 当前可分发 zip。

- `build/`
  - PyInstaller 临时构建目录。
  - 可重新生成，不应作为核心源码维护。

## 2. 用于解析 PF 规则的程序

这一层负责从 CHM、HTML、AoN 等来源抽取、修复、校验法术数据。它们不是便携版运行时必需，但用于重新生产 `result/` 数据。

### 原始资料

- `Pathfinder v2.14 SC.chm`
- `Pathfinder v2.14 SC.chw`
- `Pathfinder v2.14 SC/`
- `spell/*.html`

这些是本地 Pathfinder 资料源，解析脚本会从这些文件提取法术内容。

### CHM/HTML 转换与导出

- `convert_chm_to_html_viewer.py`
  - 把 CHM 或解包目录转换为单文件 HTML 阅读器。

- `export_spell_html.py`
- `export_spell_index.py`
- `export_spell_markdown.py`
- `scripts/extract/export_spell_tables.py`
  - 导出法术索引、Markdown、HTML 或表格。

### 主要抽取脚本

- `scripts/extract/extract_spells.py`
- `scripts/extract/extract_spells_step1.py`
- `scripts/extract/extract_spells_html.py`
- `scripts/extract/batch_extract_spell_html.py`
- `scripts/extract/extract_spells_apg.py`
- `scripts/extract/extract_spells_oa.py`
- `scripts/books/extract_special_books.py`
- `scripts/books/extract_more_books.py`
- `scripts/books/extract_missing_books.py`
- `scripts/books/extract_player_companion_books.py`
- `scripts/books/extract_isg_isi_books.py`

这些脚本负责从不同书籍、不同格式、不同缺口来源中抽取结构化法术。

### 数据修复与补全脚本

- `scripts/fix/fix_level_parse_fails.py`
- `scripts/fix/fix_mismatched_books.py`
- `scripts/localize/fill_cn_names_from_chm.py`
- `scripts/fix/auto_fix_source_spell_names.py`
- `scripts/locate/locate_spells_from_index.py`

这些脚本负责修复等级解析、书籍来源、中文名、索引定位等问题。

### AoN 覆盖与补充

- `scripts/books/fetch_player_companion_aon_supplements.py`
- `scripts/books/build_player_companion_source_manifest.py`
- `scripts/analysis/expand_aon_coverage_check.py`

这些脚本负责与 AoN 来源、Player Companion 补充数据、来源数量审计相关的工作。

### 临时调试脚本

- `scripts/_*_tmp.py`
- `debug_*.py`
- `debug_*.txt`
- `tmp_*.py`
- `tmp_*.txt`
- `check_results.py`
- `find_spell_sections.py`

这些文件主要是阶段性调试资产。建议后续统一移动到 `devtools/` 或 `archive/debug/`，并从正式打包流程中排除。

## 3. 生成前端页面以及对应 RAG 的完整程序

这一层是用户实际使用的完整 Web + RAG 系统。

### 后端 API

- `api/main.py`
  - FastAPI 路由。
  - 提供：
    - `GET /api/health`
    - `GET /api/spell-sources`
    - `GET /api/spells/keyword`
    - `POST /api/rag/search`
    - `POST /api/rag/ask`

- `api/config.py`
  - 配置管理。
  - 运行源码时项目根目录为仓库根。
  - 打包后项目根目录为 exe 所在目录。
  - `.env` 固定从项目根或 exe 同目录读取。

- `api/models.py`
  - Pydantic 数据结构。
  - 核心模型是 `SpellRecord`。

### RAG 服务层

- `api/services/data_loader.py`
  - 从 `result/*/spells-*.json` 或 `spells-*-model.json` 加载法术。
  - 把不同来源 schema 统一为 `SpellRecord`。

- `api/services/indexer.py`
  - 构建 Chroma 向量索引。
  - 构建 BM25 关键词索引。

- `api/services/retriever.py`
  - 混合检索。
  - BM25 + Chroma vector + RRF 融合。
  - 支持来源、学派、环位、普通/神话法术过滤。

- `api/services/embedding_client.py`
  - Embedding 适配层。
  - 支持 OpenAI-compatible API 或本地 sentence-transformers。

- `api/services/generator.py`
  - LLM 调用。
  - 生成带引用的 RAG 回答。
  - LLM 不可用时降级为检索结果。

- `api/utils/text_utils.py`
  - 文本清洗、名称拆分、等级解析、搜索文本构建等工具。

### 前端页面

- `web/index.html`
  - 页面结构。
  - 作为车卡器和资料查询的总入口。
  - 当前挂载角色卡、人物卡状态记录器、法术、状态、专长、职业和奇物页面。

- `web/assets/js/index.js`
  - 首页导航切换逻辑。
  - 根据 hash 在车卡器、人物卡状态记录器、法术、状态、专长、职业、奇物之间切换。

- `web/status_tracker.html`
  - 人物卡状态记录器页面。
  - 与车卡器和资料查询并列，第一阶段独立维护状态数据，不读取当前车卡器。

- `web/assets/js/status-tracker.js`
  - 人物卡状态记录器核心逻辑。
  - 使用 `localStorage` 维护多个角色状态档案。
  - 支持基础数值、职业能力、法术、当前专长、当前 Buff、其他生物、奇物和剧情备注 8 个可填写栏位。
  - 支持自动保存、角色档案切换、复制、删除、JSON 导入导出。

- `web/assets/css/status-tracker.css`
  - 人物卡状态记录器样式。
  - 提供两栏布局、栏位导航、表单卡片、条目列表和移动端响应式布局。

- `web/spells.html`
  - 旧版法术检索/RAG 页面入口。

- `web/spells_filter.html`
  - GitHub 更新引入的组合式法术筛选页。
  - 面向资料查询，可按职业、环位、学派、来源等条件筛选。

- `web/assets/js/spell-rag.js`
  - 法术检索与 RAG 问答前端逻辑。

- `web/assets/js/spell-filter-core.js`
  - 组合筛选页的法术数据归一化、职业别名归一和过滤核心。

- `web/assets/js/spell-filter.js`
  - 组合筛选页的控件状态、结果列表和详情渲染。

- `web/conditions.html`
  - GitHub 更新引入的状态查询页面。
  - 展示状态叠加规则、状态列表、分类筛选和状态详情。

- `web/assets/data/conditions.json`
  - 状态查询页使用的静态规则数据。

- `web/assets/js/conditions.js`
  - 状态查询页的搜索、分类筛选和详情渲染逻辑。

- `web/style.css`
  - 前端样式。

- `web/assets/css/spell-filter.css`
  - 组合式法术筛选页面样式。

- `web/assets/css/spell-view-switch.css`
  - 法术视图切换入口样式。

- `web/assets/css/conditions.css`
  - 状态查询页面样式。

### 内容完整性修复工具

- `tools/repair_content_integrity.py`
  - GitHub 更新引入的修复工具。
  - dry-run 模式会生成审计报告，不写入数据。
  - apply 模式会修复法术职业别名、法术职业/环位重复项，并清理专长字段中的后续专长串联污染。

- `Apply-Repair.ps1`
  - PowerShell 入口。
  - 默认调用 dry-run；传入 `-Apply` 才会写入。
  - 入口已显式设置 UTF-8 输出，避免 Windows PowerShell 5.1 下中文日志显示异常。

### 索引构建与评估

- `scripts/build/build_index.py`
  - 离线构建 RAG 索引。

- `scripts/build/evaluate.py`
  - 基于 `eval/gold_set.json` 评估检索和生成质量。

- `eval/gold_set.json`
  - 问答评估集。

## 4. 数据以及数据结构

### 结构化法术数据

- `result/`
  - 当前核心法术数据目录。
  - 每个来源一本书或一个来源目录，例如：
    - `result/crb/spells-crb.json`
    - `result/apg/spells-apg.json`
    - `result/um/spells-um.json`
    - `result/ma/spells-ma.json`
  - 当前约 100 多个来源目录，约 3100 条法术记录。

### 统一运行时数据结构

后端最终会统一成 `api.models.SpellRecord`：

- `spell_id`
- `name`
- `name_zh`
- `name_en`
- `source`
- `spell_type`
- `school`
- `level_raw`
- `level_by_class`
- `cast_time`
- `components`
- `range`
- `target`
- `duration`
- `save`
- `spell_resistance`
- `effect`

前端会通过 `normalizeSpell()` 再映射为可展示字段，例如：

- `name`
- `display_name`
- `学派`
- `等级`
- `施法时间`
- `成分`
- `范围`
- `目标`
- `持续时间`
- `豁免`
- `法术抗力`
- `效果`
- `source_book`

### RAG 索引数据

- `data/chroma_db/`
  - Chroma 向量索引。
  - 用于语义检索。

- `data/bm25_index/index.pkl`
  - BM25 关键词索引。
  - 用于关键词检索和向量不可用时降级。

### 来源审计与补充数据

- `data/aon_source_counts.json`
- `data/aon_source_spell_cache.json`
- `data/local_chm_only_sources.json`
- `data/player_companion_aon_supplements.json`

这些文件用于来源数量、AoN 覆盖、补充来源和审计。

## 建议的目标目录结构

后续如果要真正移动文件，建议整理为：

```text
PF_RAG/
  app/
    api/
    web/
    run_web.py
  tools/
    build_index.py
    evaluate.py
    package_portable.py
  extractors/
    chm/
    html/
    aon/
    fixes/
  data/
    runtime/
      chroma_db/
      bm25_index/
    metadata/
    raw_sources/
  result/
    ...
  dist/
  docs/
  archive/
    debug/
    tmp/
    old_logs/
```

## 建议的整理顺序

1. 保持当前可运行版本不动，先维护本说明文档。
2. 把临时调试脚本和日志归档到 `archive/`，不影响应用运行。
3. 把解析类脚本统一移动到 `extractors/`，并修正相对路径。
4. 把运行应用代码移动到 `app/`，保留根目录薄入口 `run_web.py` 兼容打包。
5. 更新 `package_portable.py`，只收集运行必需文件。
6. 每移动一层就执行：
   - `python scripts/build/build_index.py`
   - `python run_web.py`
   - `python scripts/package/package_portable.py`

## 当前最重要的边界

- 便携版运行只需要：`pathfinder_tools.exe`、`web/`、`result/`、`data/`、`.env`。
- RAG 重新建索引需要：`api/`、`scripts/build/build_index.py`、`result/`、`.env`。
- 重新抽取法术数据才需要：`spell/`、`Pathfinder v2.14 SC*`、`scripts/extract_*.py`、修复脚本。
- `build/`、`__pycache__/`、大部分 `debug/tmp` 文件不是运行必需。
