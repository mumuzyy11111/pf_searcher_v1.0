(() => {
  const modeEl = document.getElementById("search-mode");
  const inputEl = document.getElementById("search-input");
  const btnEl = document.getElementById("search-btn");
  const totalEl = document.getElementById("total-count");
  const resultCountEl = document.getElementById("result-count");
  const resultsEl = document.getElementById("results");
  const typeListEl = document.getElementById("type-list");
  const bookListEl = document.getElementById("book-list");
  const detailEl = document.getElementById("feat-detail");

  const MAX_RENDER = 500;
  let feats = [];
  let currentRows = [];
  let selectedId = "";
  let selectedType = "all";
  let selectedBook = "all";

  const normalize = (v) => String(v || "").toLowerCase().replace(/\s+/g, " ").trim();

  const TYPE_ORDER = [
    "通用",
    "战斗",
    "超魔",
    "造物",
    "团队",
    "故事",
    "神话",
    "流派",
    "种族",
    "怪物",
    "重击",
    "表演",
    "勇毅",
    "派头",
    "凝视",
    "魔宠",
    "物品掌握",
    "武器掌握",
    "防具掌握",
    "盾牌掌握",
  ];

  const displayName = (f) => {
    if (f.name_cn && f.name_en) return `${f.name_cn}（${f.name_en}）`;
    return f.name_cn || f.name_en || f.name_raw || "(未命名专长)";
  };

  const hasAny = (text, terms) => terms.some((term) => text.includes(term.toLowerCase()));

  const classifyFeat = (f) => {
    const sourceBooks = Array.isArray(f.books) ? f.books : (f.source_book ? [f.source_book] : []);
    const text = normalize([
      f.name_raw,
      f.name_cn,
      f.name_en,
      f.prerequisites,
      f.benefit_summary,
      f.detail_text,
      f.flavor_text,
      sourceBooks.join(" "),
    ].join(" "));
    const name = normalize([f.name_raw, f.name_en, f.name_cn].join(" "));
    const types = new Set();

    if (f.story_prerequisites || f.immediate_benefit || f.story_goal || f.completion_benefit || hasAny(text, ["〔故事〕", "(story)", "story feat", "即时收益", "专长目标", "完成收益"])) types.add("故事");
    if (hasAny(text, ["〔神话〕", "(mythic)", "mythic feat", "神话之力", "神话阶层", "神话道途"]) || sourceBooks.some((book) => book.includes("神话冒险") || book.startsWith("MA "))) types.add("神话");
    if (hasAny(text, ["〔超魔〕", "(metamagic)", "metamagic feat", "法术位", "更高环级"]) || /\bspell\b/.test(name) && hasAny(text, ["uses a spell slot", "higher than", "法术位", "超魔"])) types.add("超魔");
    if (hasAny(text, ["〔造物〕", "(item creation)", "item creation feat", "制造魔法", "制造奇物", "制造魔杖", "制造法杖", "制造权杖", "抄写卷轴", "魔法物品"])) types.add("造物");
    if (hasAny(text, ["〔团队〕", "(teamwork)", "teamwork feat", "同样拥有此专长", "也拥有此专长的盟友", "ally who also has this feat"])) types.add("团队");
    if (hasAny(text, ["〔流派〕", "(style)", "style feat", "流派专长"]) || /\bstyle\b/.test(name)) types.add("流派");
    if (hasAny(text, ["〔表演〕", "(performance)", "performance feat", "表演战斗", "performance combat"])) types.add("表演");
    if (hasAny(text, ["〔重击〕", "(critical)", "critical feat", "重击专长", "确认重击"])) types.add("重击");
    if (hasAny(text, ["〔勇毅〕", "(grit)", "grit feat", "勇毅", "grit class feature"])) types.add("勇毅");
    if (hasAny(text, ["〔派头〕", "(panache)", "panache feat", "派头", "panache class feature"])) types.add("派头");
    if (hasAny(text, ["〔凝视〕", "(stare)", "stare feat", "痛苦凝视", "凝视"])) types.add("凝视");
    if (hasAny(text, ["〔魔宠〕", "(familiar)", "familiar feat", "魔宠", "familiar"])) types.add("魔宠");
    if (hasAny(text, ["(item mastery)", "item mastery feat", "物品掌握"])) types.add("物品掌握");
    if (hasAny(text, ["(weapon mastery)", "weapon mastery feat", "武器掌握", "weapon training"])) types.add("武器掌握");
    if (hasAny(text, ["(armor mastery)", "armor mastery feat", "防具掌握", "armor training"])) types.add("防具掌握");
    if (hasAny(text, ["(shield mastery)", "shield mastery feat", "盾牌掌握"])) types.add("盾牌掌握");
    if (hasAny(text, ["〔种族〕", "(racial)", "racial feat", "种族专长"]) || hasAny(text, ["矮人", "精灵", "侏儒", "半身人", "半兽人", "半精灵", "人类", "aasimar", "tiefling", "dwarf", "elf", "gnome", "halfling", "human"])) types.add("种族");
    if (sourceBooks.some((book) => /^B\d\b/.test(book) || book.includes("怪物图鉴") || book.includes("Monster Codex")) || hasAny(text, ["(monster)", "monster feat", "怪物专长", "特殊攻击", "天生武器", "natural attack"])) types.add("怪物");
    if (hasAny(text, ["〔战斗〕", "(combat)", "combat feat", "战斗专长", "基本攻击加值", "base attack bonus", "bab ", "战技", "借机攻击"])) types.add("战斗");

    if (!types.size) types.add("通用");
    return TYPE_ORDER.filter((type) => types.has(type)).concat([...types].filter((type) => !TYPE_ORDER.includes(type)));
  };

  const normalizeFeat = (f) => ({
    id: f.feat_id || f.match_key || displayName(f),
    title: displayName(f),
    nameCn: f.name_cn || "",
    nameEn: f.name_en || "",
    nameRaw: f.name_raw || "",
    prerequisites: f.prerequisites || "",
    benefit: f.benefit_summary || "",
    detail: f.detail_text || "",
    books: Array.isArray(f.books) ? f.books : [],
    types: classifyFeat(f),
    raw: f,
  });

  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const renderText = (value, fallback = "-") => {
    const text = String(value || "").trim();
    return text ? escapeHtml(text) : fallback;
  };

  const loadFeats = async () => {
    const resp = await fetch("/result/feats/feats-frontend.json");
    if (!resp.ok) throw new Error("加载专长数据失败");
    const data = await resp.json();
    const rows = Array.isArray(data.feats) ? data.feats : [];
    feats = rows.map(normalizeFeat);
    totalEl.textContent = `共 ${feats.length} 条专长`;
  };

  const featMatches = (item, query, mode) => {
    if (!query) return true;
    if (mode === "name") {
      return [item.title, item.nameCn, item.nameEn, item.nameRaw].some((v) => normalize(v).includes(query));
    }
    const keywordText = [
      item.title,
      item.prerequisites,
      item.benefit,
      item.detail,
      item.books.join(" "),
      item.types.join(" "),
      JSON.stringify(item.raw.attached_tables || []),
    ].join(" ");
    return normalize(keywordText).includes(query);
  };

  const itemInSelectedType = (item) => selectedType === "all" || item.types.includes(selectedType);

  const itemInSelectedBook = (item) => selectedBook === "all" || item.books.includes(selectedBook);

  const getTypeCounts = () => {
    const counts = new Map();
    feats.filter(itemInSelectedBook).forEach((item) => {
      item.types.forEach((type) => counts.set(type, (counts.get(type) || 0) + 1));
    });
    return TYPE_ORDER
      .filter((type) => counts.has(type))
      .map((type) => [type, counts.get(type)])
      .concat([...counts.entries()].filter(([type]) => !TYPE_ORDER.includes(type)).sort((a, b) => a[0].localeCompare(b[0], "zh-Hans-CN")));
  };

  const getBookCounts = () => {
    const counts = new Map();
    feats.filter(itemInSelectedType).forEach((item) => {
      const books = item.books.length ? item.books : ["未标注书籍"];
      books.forEach((book) => counts.set(book, (counts.get(book) || 0) + 1));
    });
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh-Hans-CN"));
  };

  const renderFilterList = (container, rows, activeValue, onClick) => {
    container.innerHTML = "";
    rows.forEach(([value, label, count]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `book-tab${activeValue === value ? " active" : ""}`;
      btn.dataset.value = value;
      btn.innerHTML = `<span>${escapeHtml(label)}</span><em>${count}</em>`;
      btn.addEventListener("click", () => onClick(value));
      container.appendChild(btn);
    });
  };

  const renderFilterLists = () => {
    const typeTotal = feats.filter(itemInSelectedBook).length;
    const typeRows = [["all", "全部类型", typeTotal], ...getTypeCounts().map(([type, count]) => [type, type, count])];
    renderFilterList(typeListEl, typeRows, selectedType, (value) => {
      selectedType = value;
      selectedBook = "all";
      selectedId = "";
      renderFilterLists();
      doSearch();
    });

    const bookTotal = feats.filter(itemInSelectedType).length;
    const bookRows = [["all", "全部书籍", bookTotal], ...getBookCounts().map(([book, count]) => [book, book, count])];
    renderFilterList(bookListEl, bookRows, selectedBook, (value) => {
      selectedBook = value;
      selectedId = "";
      renderFilterLists();
      doSearch();
    });
  };

  const renderDetail = (item) => {
    if (!item) {
      detailEl.innerHTML = '<div class="empty-detail">选择左侧专长查看详情。</div>';
      return;
    }
    const attachedTables = Array.isArray(item.raw.attached_tables) ? item.raw.attached_tables : [];
    const typeTags = item.types.map((type) => `<span class="type-badge">${escapeHtml(type)}</span>`).join("");
    const tableHtml = attachedTables.length
      ? `<div class="detail-section"><h4>附表</h4>${attachedTables.map((table) => {
          const title = table.title ? `<div class="attached-table-title">${escapeHtml(table.title)}</div>` : "";
          const rows = Array.isArray(table.rows) ? table.rows : [];
          const body = rows.slice(0, 80).map((row) => {
            const cells = Array.isArray(row) ? row : Object.values(row || {});
            return `<tr>${cells.map((cell) => `<td>${renderText(cell)}</td>`).join("")}</tr>`;
          }).join("");
          return `<div class="attached-table">${title}<table>${body}</table></div>`;
        }).join("")}</div>`
      : "";

    detailEl.innerHTML = `
      <article class="feat-detail-card">
        <div class="detail-kicker">${renderText(item.books.join("、"))}</div>
        <h2>${escapeHtml(item.title)}</h2>
        <div class="type-badges">${typeTags}</div>
        <div class="detail-section">
          <h4>先决条件</h4>
          <p>${renderText(item.prerequisites)}</p>
        </div>
        <div class="detail-section">
          <h4>效果简述</h4>
          <p>${renderText(item.benefit)}</p>
        </div>
        <div class="detail-section">
          <h4>详述</h4>
          <p>${renderText(item.detail)}</p>
        </div>
        ${item.raw.flavor_text ? `
          <div class="detail-section">
            <h4>描述</h4>
            <p>${renderText(item.raw.flavor_text)}</p>
          </div>` : ""}
        ${item.raw.immediate_benefit ? `
          <div class="detail-section">
            <h4>即时收益</h4>
            <p>${renderText(item.raw.immediate_benefit)}</p>
          </div>` : ""}
        ${item.raw.story_goal ? `
          <div class="detail-section">
            <h4>专长目标</h4>
            <p>${renderText(item.raw.story_goal)}</p>
          </div>` : ""}
        ${item.raw.completion_benefit ? `
          <div class="detail-section">
            <h4>完成收益</h4>
            <p>${renderText(item.raw.completion_benefit)}</p>
          </div>` : ""}
        ${tableHtml}
      </article>
    `;
  };

  const render = (rows, emptyMessage = "没有匹配结果。") => {
    currentRows = rows.slice(0, MAX_RENDER);
    resultsEl.innerHTML = "";
    if (!rows.length) {
      resultsEl.innerHTML = `<div class="empty-list">${escapeHtml(emptyMessage)}</div>`;
      renderDetail(null);
      return;
    }

    if (!selectedId || !currentRows.some((item) => item.id === selectedId)) {
      selectedId = currentRows[0].id;
    }

    currentRows.forEach((item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `feat-row${item.id === selectedId ? " active" : ""}`;
      row.innerHTML = `
        <span class="feat-row-title">${escapeHtml(item.title)}</span>
        <span class="feat-row-book">${escapeHtml(item.types.join("、"))} · ${escapeHtml(item.books.join("、") || "-")}</span>
        <span class="feat-row-summary">${escapeHtml(item.benefit || item.prerequisites || "无摘要")}</span>
      `;
      row.addEventListener("click", () => {
        selectedId = item.id;
        render(currentRows);
      });
      resultsEl.appendChild(row);
    });

    renderDetail(currentRows.find((item) => item.id === selectedId) || currentRows[0]);
  };

  const doSearch = () => {
    const mode = modeEl.value;
    const query = normalize(inputEl.value);
    if (selectedType === "all" && selectedBook === "all" && !query) {
      resultCountEl.textContent = "选择类型、书籍或输入关键词开始检索";
      selectedId = "";
      render([], "左侧选择专长类型或书籍，或输入名称/关键词后搜索。");
      return;
    }
    const rows = feats.filter((item) => {
      return itemInSelectedType(item) && itemInSelectedBook(item) && featMatches(item, query, mode);
    });
    resultCountEl.textContent = `匹配 ${rows.length} 条${rows.length > MAX_RENDER ? `，仅展示前 ${MAX_RENDER} 条` : ""}`;
    render(rows);
  };

  modeEl.addEventListener("change", () => {
    inputEl.placeholder = modeEl.value === "name" ? "输入专长名称" : "输入关键词（在全部字段中匹配）";
    inputEl.value = "";
    selectedId = "";
    selectedType = "all";
    selectedBook = "all";
    renderFilterLists();
    doSearch();
  });
  btnEl.addEventListener("click", doSearch);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  loadFeats()
    .then(() => {
      renderFilterLists();
      doSearch();
    })
    .catch((err) => {
      totalEl.textContent = "加载失败";
      resultCountEl.textContent = String(err.message || err);
      render([]);
    });
})();
