# PF 法术双视图修复 v3

本补丁针对当前 `mumuzyy11111/pf_searcher_v1.0` 的 `main` 分支结构。

## 修复内容

1. 法术标签默认打开 `spells_filter.html` 组合筛选页。
2. 组合筛选页顶部保留“名称 / 关键词 / 智能问答”入口。
3. 原 `spells.html` 顶部新增“组合筛选”返回入口，因此切换后不会再无法返回。
4. 原页的搜索模式仅保留：按名称、按关键词、智能问答。
5. 移除原页中已经被组合筛选取代的“按职业”和“按学派”选项。
6. 职业与环位仍按同一条职业等级记录配对，例如：
   - 法师/术士 3，吟游诗人 4
   - 法师 + 3环：命中
   - 术士 + 3环：命中
   - 吟游诗人 + 4环：命中
   - 吟游诗人 + 3环：不命中

## 安装

将压缩包解压到包含 `run_web.py` 的项目根目录，覆盖同名文件，然后重启：

```powershell
python .\run_web.py
```

浏览器按 `Ctrl + F5` 强制刷新。

## 验证

```powershell
Select-String -Path .\web\index.html -Pattern "spells_filter.html"
Select-String -Path .\web\spells.html -Pattern "spells_filter.html"
Select-String -Path .\web\spells_filter.html -Pattern "spells.html"
```

三个命令都应返回匹配结果。
