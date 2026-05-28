(() => {
  const totalEl = document.getElementById("total-count");
  const resultCountEl = document.getElementById("result-count");
  const searchEl = document.getElementById("item-search");
  const clearBtn = document.getElementById("clear-search");
  const slotListEl = document.getElementById("slot-list");
  const slotTitleEl = document.getElementById("slot-title");
  const itemListEl = document.getElementById("item-list");
  const detailEl = document.getElementById("item-detail");

  const SLOT_ORDER = ["腰部", "躯体", "胸部", "眼部", "脚部", "手部", "头部", "头饰", "颈部", "肩部", "腕部", "无位置", "可变", "脸部", "未标明"];
  let items = [];
  let slots = [];
  let activeSlot = "";
  let selectedItemId = "";

  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const normalize = (value) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  const displayName = (item) => {
    if (item.name_cn && item.name_en) return `${item.name_cn}（${item.name_en}）`;
    return item.name_cn || item.name_en || item.name_raw || "未命名奇物";
  };
  const searchableText = (item) => [
    item.name_raw, item.name_cn, item.name_en, item.slot, item.category, item.source_book,
    item.price, item.aura, item.caster_level, item.detail_text,
    Array.isArray(item.aliases) ? item.aliases.join(" ") : "",
    Array.isArray(item.iounRows)
      ? item.iounRows.map((row) => [row.name, row.shape, row.price, row.aura, row.casterLevel, row.effect, row.resonance].join(" ")).join(" ")
      : "",
  ].join(" ");
  const bySlotOrder = (a, b) => {
    const ai = SLOT_ORDER.indexOf(a.slot);
    const bi = SLOT_ORDER.indexOf(b.slot);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.slot.localeCompare(b.slot, "zh-Hans-CN");
  };
  const numericIdSuffix = (item) => {
    const match = String(item.item_id || "").match(/-(\d+)$/);
    return match ? Number(match[1]) : 0;
  };
  const isCoreIounStub = (item) => /^艾恩石\s+IOUN STONE\s*[-－]/i.test(String(item.name_raw || item.name_cn || ""));
  const isThornyIounSummary = (item) => normalize([item.name_raw, item.name_cn, item.name_en].join(" ")).includes("ioun stone, thorny")
    || String(item.name_cn || "").includes("刺球形艾恩石");
  const isIounTableItem = (item) => ["page_567.html", "page_1254.html"].includes(item.source_page)
    && String(item.category || "").includes("艾恩石");
  const isAggregatedIounItem = (item) => isCoreIounStub(item) || isThornyIounSummary(item) || isIounTableItem(item);
  const iounSourceRank = (item) => {
    if (item.source_page === "page_1254.html") return 0;
    if (item.source_page === "page_567.html") return 1;
    return 2;
  };
  const priceNumber = (value) => {
    const digits = String(value || "").replace(/[^0-9]/g, "");
    return digits ? Number(digits) : null;
  };
  const priceRange = (rows) => {
    const values = rows.map((row) => priceNumber(row.price)).filter((value) => Number.isFinite(value));
    if (!values.length) return "";
    const min = Math.min(...values).toLocaleString("en-US");
    const max = Math.max(...values).toLocaleString("en-US");
    return min === max ? `${min}gp` : `${min}-${max}gp`;
  };
  const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const extractDetailField = (detail, labels) => {
    const text = String(detail || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    const stopLabels = ["形状", "价格", "效果", "共振", "灵光", "施法者等级", "CL", "制造条件", "制造需求", "制造要求", "制造成本", "成本"];
    const labelAlt = labels.map(escapeRegExp).join("|");
    const stopAlt = stopLabels.map(escapeRegExp).join("|");
    const match = text.match(new RegExp(`(?:${labelAlt})\\s*[:：]\\s*(.*?)(?=\\s*(?:${stopAlt})\\s*[:：]|$)`));
    return match ? match[1].trim().replace(/[；;。]\s*$/, "") : "";
  };
  const iounDisplayName = (item, fallbackName) => {
    if (normalize(item.name_en) === "iridescent" || String(item.name_cn || "").includes("多彩")) {
      return "彩虹 / 多彩（Iridescent）";
    }
    return fallbackName;
  };
  const makeIounAggregate = (rawItems) => {
    const sourceItems = rawItems.filter(isAggregatedIounItem);
    if (!sourceItems.length) return null;

    const aliases = sourceItems
      .flatMap((item) => [item.name_raw, item.name_cn, item.name_en])
      .filter(Boolean);
    const ordered = sourceItems
      .filter((item) => isIounTableItem(item))
      .sort((a, b) => iounSourceRank(a) - iounSourceRank(b) || numericIdSuffix(a) - numericIdSuffix(b));

    const rows = [];
    const seen = new Set();
    let lastBaseName = "";
    for (const item of ordered) {
      const rawName = displayName(item);
      const genericVariant = rawName === "破损的" || rawName === "缺陷的";
      if (!genericVariant) lastBaseName = rawName;

      const display = genericVariant && lastBaseName ? `${lastBaseName}（${rawName}）` : rawName;
      const name = iounDisplayName(item, display);
      const shape = item.shape || extractDetailField(item.detail_text, ["形状"]);
      const effect = item.effect || extractDetailField(item.detail_text, ["效果"]);
      const resonance = item.resonance || extractDetailField(item.detail_text, ["共振"]);
      const usefulText = [item.shape, item.price, item.aura, item.caster_level, effect, resonance, item.detail_text].join(" ").trim();
      if (!usefulText) continue;

      const key = normalize([item.name_en || name, item.shape, genericVariant ? rawName : "", effect].join("|"));
      if (seen.has(key)) continue;
      seen.add(key);

      rows.push({
        name,
        shape,
        price: item.price || "",
        aura: item.aura || "",
        casterLevel: item.caster_level || "",
        effect,
        resonance,
        detail: item.detail_text || "",
      });
    }

    if (!rows.length) return null;
    return {
      item_id: "__ioun-stone-aggregate",
      type: "wondrous_item_group",
      slot: "无位置",
      category: "艾恩石",
      name_raw: "艾恩石 Ioun Stone",
      name_cn: "艾恩石",
      name_en: "Ioun Stone",
      price: priceRange(rows),
      source_book: "CRB / AG / 其他来源",
      source_page: "page_567.html; page_1254.html",
      aura: "可变",
      caster_level: "通常 12 级",
      weight: "-",
      requirements: "制造奇物；具体条件见各颜色行",
      cost: "",
      effect: "不同颜色和形状的艾恩石效果不同；已整理为下表。",
      resonance: "置入寻路仪时的共振效果见下表。",
      detail_text: "艾恩石作为一个合并条目展示。原始数据中按颜色拆开的条目已在此表中汇总，包含“彩虹 / 多彩（Iridescent）”等颜色变体。",
      iounRows: rows,
      aliases,
    };
  };
  const buildSlotsFromItems = (rows) => {
    const counts = new Map();
    rows.forEach((item) => {
      const slot = item.slot || "未标明";
      counts.set(slot, (counts.get(slot) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([slot, item_count]) => ({ slot, item_count }))
      .sort(bySlotOrder);
  };
  const normalizeLoadedItems = (rawItems) => {
    const aggregate = makeIounAggregate(rawItems);
    const filtered = rawItems.filter((item) => !isAggregatedIounItem(item));
    return aggregate ? [aggregate, ...filtered] : rawItems;
  };

  async function loadData() {
    const resp = await fetch(`/result/items/wondrous-items.json?v=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const rawItems = Array.isArray(data.items) ? data.items : [];
    items = normalizeLoadedItems(rawItems);
    slots = buildSlotsFromItems(items);
    activeSlot = slots[0] ? slots[0].slot : "";
    totalEl.textContent = `共 ${items.length} 个奇物，${slots.length} 个位置分类`;
  }

  function getFilteredItems() {
    const query = normalize(searchEl.value);
    return items.filter((item) => {
      if (activeSlot && item.slot !== activeSlot) return false;
      if (!query) return true;
      return normalize(searchableText(item)).includes(query);
    }).sort((a, b) => displayName(a).localeCompare(displayName(b), "zh-Hans-CN"));
  }

  function renderSlots() {
    slotListEl.innerHTML = slots.map((slot) => `
      <button class="book-tab${slot.slot === activeSlot ? " active" : ""}" type="button" data-slot="${escapeHtml(slot.slot)}">
        <span>${escapeHtml(slot.slot)}</span>
        <em>${slot.item_count}</em>
      </button>
    `).join("");
  }

  function renderSlotTitle(filtered) {
    const slot = slots.find((item) => item.slot === activeSlot);
    slotTitleEl.innerHTML = `
      <div class="detail-kicker">奇物位置</div>
      <h2>${escapeHtml(activeSlot || "未分类")}</h2>
      <div class="class-title-meta">
        <span>${slot ? slot.item_count : 0} 个条目</span>
        <span>${filtered.length} 个匹配</span>
      </div>
    `;
  }

  function renderItems(filtered) {
    if (!filtered.length) {
      itemListEl.innerHTML = `<div class="empty-list">没有匹配的奇物。</div>`;
      selectedItemId = "";
      renderDetail(null);
      return;
    }
    if (!filtered.some((item) => item.item_id === selectedItemId)) selectedItemId = filtered[0].item_id;
    itemListEl.innerHTML = filtered.map((item) => `
      <button class="feat-row${item.item_id === selectedItemId ? " active" : ""}" type="button" data-item-id="${escapeHtml(item.item_id)}">
        <span class="feat-row-title">${escapeHtml(displayName(item))}</span>
        <span class="feat-row-book">${escapeHtml([item.price, item.source_book, item.category].filter(Boolean).join(" · "))}</span>
        <span class="feat-row-summary">${escapeHtml((item.detail_text || item.effect || "").slice(0, 100))}</span>
      </button>
    `).join("");
    renderDetail(filtered.find((item) => item.item_id === selectedItemId));
  }

  function detailRow(label, value) {
    if (!value) return "";
    return `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`;
  }
  function renderIounTable(item) {
    const rows = Array.isArray(item.iounRows) ? item.iounRows : [];
    if (!rows.length) return "";
    const body = rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.name || "-")}</td>
        <td>${escapeHtml(row.shape || "-")}</td>
        <td>${escapeHtml(row.price || "-")}</td>
        <td>${escapeHtml([row.aura, row.casterLevel].filter(Boolean).join(" / ") || "-")}</td>
        <td>${escapeHtml(row.effect || "-")}</td>
        <td>${escapeHtml(row.resonance || "-")}</td>
      </tr>
    `).join("");
    return `
      <div class="detail-section">
        <h4>颜色与效果</h4>
        <div class="attached-table ioun-table-wrap">
          <table class="ioun-table">
            <thead>
              <tr>
                <th>颜色</th>
                <th>形状</th>
                <th>价格</th>
                <th>灵光 / CL</th>
                <th>效果</th>
                <th>共振</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderDetail(item) {
    if (!item) {
      detailEl.innerHTML = `<div class="empty-detail">选择左侧奇物查看详情。</div>`;
      return;
    }
    const badges = [item.slot, item.category, item.source_book, item.source_page].filter(Boolean)
      .map((value) => `<span class="type-badge">${escapeHtml(value)}</span>`).join("");
    const meta = [
      detailRow("价格", item.price),
      detailRow("位置", item.slot),
      detailRow("施法者等级", item.caster_level),
      detailRow("灵光", item.aura),
      detailRow("重量", item.weight),
      detailRow("声望", item.reputation),
      detailRow("制造要求", item.requirements),
      detailRow("制造成本", item.cost),
    ].join("");
    detailEl.innerHTML = `
      <article class="feat-detail-card">
        <div class="detail-kicker">${escapeHtml(item.category || "奇物")}</div>
        <h2>${escapeHtml(displayName(item))}</h2>
        <div class="type-badges">${badges}</div>
        <div class="detail-section">
          <h4>基础信息</h4>
          <div class="class-meta-grid">${meta || detailRow("来源页", item.source_page)}</div>
        </div>
        ${item.iounRows ? renderIounTable(item) : ""}
        ${item.effect ? `<div class="detail-section"><h4>效果</h4><p>${escapeHtml(item.effect)}</p></div>` : ""}
        ${item.resonance ? `<div class="detail-section"><h4>共振</h4><p>${escapeHtml(item.resonance)}</p></div>` : ""}
        ${item.detail_text ? `<div class="detail-section"><h4>正文</h4><p>${escapeHtml(item.detail_text)}</p></div>` : ""}
      </article>
    `;
  }

  function render() {
    renderSlots();
    const filtered = getFilteredItems();
    renderSlotTitle(filtered);
    renderItems(filtered);
    resultCountEl.textContent = `当前分类 ${filtered.length} 个匹配`;
  }

  slotListEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-slot]");
    if (!btn) return;
    activeSlot = btn.dataset.slot || "";
    selectedItemId = "";
    render();
  });

  itemListEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-item-id]");
    if (!btn) return;
    selectedItemId = btn.dataset.itemId || "";
    render();
  });

  searchEl.addEventListener("input", () => {
    selectedItemId = "";
    render();
  });
  clearBtn.addEventListener("click", () => {
    searchEl.value = "";
    selectedItemId = "";
    render();
    searchEl.focus();
  });

  loadData().then(render).catch((err) => {
    totalEl.textContent = "加载失败";
    resultCountEl.textContent = String(err.message || err);
    detailEl.innerHTML = `<div class="empty-detail">奇物数据加载失败。</div>`;
  });
})();
