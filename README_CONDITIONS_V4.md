# PF 状态表补丁 v4（基于仅修改法术布局的 v3）

本补丁以 `pf_spell_dual_view_fix_v3` 为基础，只加入规则资料功能，不包含 Docker、Caddy、PWA、Windows Server 或其他网站部署文件。

## 新增内容

- 工具台侧栏新增“状态”入口。
- 新增 `web/conditions.html` 状态浏览器。
- 收录用户提供的 34 个状态及完整规则。
- 支持中文名、英文名、别名、规则正文和数值全文搜索。
- 支持按“生命与伤势、感官、行动限制、恐惧、擒抱、物品”等分类筛选。
- 左侧状态列表、右侧完整详情，手机端自动改为上下布局。
- 状态详情包含关键效果、完整规则、表格和相关状态快捷跳转。
- 保留原有法术组合筛选和“名称 / 关键词 / 智能问答”双视图。

## 安装

把压缩包内所有文件复制到项目根目录并覆盖同名文件。项目根目录应当包含 `run_web.py` 和 `web/`。

启动后打开：

```text
http://localhost:8000/web/index.html#conditions
```

## 修改和新增文件

- `web/index.html`
- `web/assets/js/index.js`
- `web/conditions.html`
- `web/assets/css/conditions.css`
- `web/assets/js/conditions.js`
- `web/assets/data/conditions.json`
- `web/spells.html`
- `web/spells_filter.html`
- `web/character.html`
- `web/feats.html`
- `web/classes.html`
- `web/items.html`
- 原 v3 法术组合筛选相关文件

## 数据维护

以后增加状态时，只需要在 `web/assets/data/conditions.json` 的 `conditions` 数组中增加对象。页面分类按钮、数量和搜索索引会自动更新。
