(() => {
  const DATA_URL = "assets/data/conditions.json?v=20260626-condition-v1";
  const state = {
    all: [],
    filtered: [],
    activeId: null,
    category: "全部",
    query: "",
  };

  const els = {
    count: document.getElementById("condition-count"),
    generalRule: document.getElementById("general-rule"),
    search: document.getElementById("condition-search"),
    clear: document.getElementById("clear-search"),
    categories: document.getElementById("category-filters"),
    resultCount: document.getElementById("result-count"),
    list: document.getElementById("condition-list"),
    detail: document.getElementById("condition-detail"),
  };

  const normalize = (value) => String(value ?? "").toLocaleLowerCase("zh-CN").replace(/\s+/g, " ").trim();

  function blockText(block) {
    if (!block) return "";
    if (block.type === "paragraph") return block.text || "";
    if (block.type === "list") return (block.items || []).join(" ");
    if (block.type === "table") return [...(block.headers || []), ...(block.rows || []).flat()].join(" ");
    return "";
  }

  function searchText(condition) {
    return normalize([
      condition.nameZh,
      condition.nameEn,
      ...(condition.aliases || []),
      ...(condition.categories || []),
      condition.summary,
      ...(condition.effects || []),
      ...(condition.blocks || []).map(blockText),
    ].join(" "));
  }

  function createTextElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }

  function setActiveIdFromHash() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const id = params.get("condition");
    if (id && state.all.some((item) => item.id === id)) state.activeId = id;
  }

  function updateHash(id) {
    const next = `condition=${encodeURIComponent(id)}`;
    if (location.hash.replace(/^#/, "") !== next) history.replaceState(null, "", `#${next}`);
  }

  function renderCategories() {
    const categories = Array.from(new Set(state.all.flatMap((item) => item.categories || []))).sort((a, b) => a.localeCompare(b, "zh-CN"));
    els.categories.replaceChildren();
    ["全部", ...categories].forEach((category) => {
      const button = createTextElement("button", `category-chip${state.category === category ? " active" : ""}`, category);
      button.type = "button";
      button.addEventListener("click", () => {
        state.category = category;
        applyFilters();
        renderCategories();
      });
      els.categories.appendChild(button);
    });
  }

  function applyFilters() {
    const query = normalize(state.query);
    state.filtered = state.all.filter((condition) => {
      const categoryMatch = state.category === "全部" || (condition.categories || []).includes(state.category);
      const queryMatch = !query || searchText(condition).includes(query);
      return categoryMatch && queryMatch;
    });

    if (!state.filtered.some((item) => item.id === state.activeId)) {
      state.activeId = state.filtered[0]?.id || null;
    }
    els.clear.classList.toggle("hidden", !state.query);
    els.resultCount.textContent = `当前显示 ${state.filtered.length} / ${state.all.length} 个状态`;
    renderList();
    renderDetail();
  }

  function renderList() {
    els.list.replaceChildren();
    if (!state.filtered.length) {
      els.list.appendChild(createTextElement("div", "no-results", "没有找到匹配状态，请尝试其他关键词或分类。"));
      return;
    }

    state.filtered.forEach((condition) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `condition-row${condition.id === state.activeId ? " active" : ""}`;
      button.setAttribute("aria-pressed", String(condition.id === state.activeId));

      const title = document.createElement("div");
      title.className = "condition-row-title";
      title.append(createTextElement("strong", "", condition.nameZh), createTextElement("span", "", condition.nameEn));
      button.append(title, createTextElement("p", "condition-row-summary", condition.summary));

      const tags = document.createElement("div");
      tags.className = "condition-row-tags";
      (condition.categories || []).slice(0, 3).forEach((tag) => tags.appendChild(createTextElement("span", "mini-tag", tag)));
      button.appendChild(tags);

      button.addEventListener("click", () => selectCondition(condition.id));
      els.list.appendChild(button);
    });
  }

  function appendBlock(container, block) {
    if (block.type === "paragraph") {
      container.appendChild(createTextElement("p", "", block.text));
      return;
    }
    if (block.type === "list") {
      const ul = document.createElement("ul");
      (block.items || []).forEach((item) => ul.appendChild(createTextElement("li", "", item)));
      container.appendChild(ul);
      return;
    }
    if (block.type === "table") {
      const wrap = document.createElement("div");
      wrap.className = "rule-table-wrap";
      const table = document.createElement("table");
      table.className = "rule-table";
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      (block.headers || []).forEach((header) => headRow.appendChild(createTextElement("th", "", header)));
      thead.appendChild(headRow);
      const tbody = document.createElement("tbody");
      (block.rows || []).forEach((row) => {
        const tr = document.createElement("tr");
        row.forEach((cell) => tr.appendChild(createTextElement("td", "", cell)));
        tbody.appendChild(tr);
      });
      table.append(thead, tbody);
      wrap.appendChild(table);
      container.appendChild(wrap);
    }
  }

  function renderDetail() {
    const condition = state.all.find((item) => item.id === state.activeId);
    els.detail.replaceChildren();
    if (!condition) {
      const empty = document.createElement("div");
      empty.className = "empty-detail";
      empty.append(createTextElement("strong", "", "没有可显示的状态"), createTextElement("span", "", "调整搜索条件后再试。"));
      els.detail.appendChild(empty);
      return;
    }

    els.detail.append(
      createTextElement("div", "detail-kicker", "Condition Reference"),
      createTextElement("h2", "detail-title", condition.nameZh),
      createTextElement("p", "detail-en", condition.nameEn)
    );

    if ((condition.aliases || []).length) {
      els.detail.appendChild(createTextElement("p", "alias-line", `又译 / 别名：${condition.aliases.join("、")}`));
    }

    const tags = document.createElement("div");
    tags.className = "detail-tags";
    (condition.categories || []).forEach((tag) => tags.appendChild(createTextElement("span", "detail-tag", tag)));
    els.detail.append(tags, createTextElement("p", "detail-summary", condition.summary));

    els.detail.appendChild(createTextElement("h3", "section-title", "关键效果"));
    const effectList = document.createElement("ul");
    effectList.className = "effect-list";
    (condition.effects || []).forEach((effect) => effectList.appendChild(createTextElement("li", "", effect)));
    els.detail.appendChild(effectList);

    els.detail.appendChild(createTextElement("h3", "section-title", "完整规则"));
    const body = document.createElement("div");
    body.className = "rule-body";
    (condition.blocks || []).forEach((block) => appendBlock(body, block));
    els.detail.appendChild(body);

    const relatedConditions = (condition.related || [])
      .map((id) => state.all.find((item) => item.id === id))
      .filter(Boolean);
    if (relatedConditions.length) {
      els.detail.appendChild(createTextElement("h3", "section-title", "相关状态"));
      const relatedList = document.createElement("div");
      relatedList.className = "related-list";
      relatedConditions.forEach((related) => {
        const button = createTextElement("button", "related-btn", `${related.nameZh} · ${related.nameEn}`);
        button.type = "button";
        button.addEventListener("click", () => selectCondition(related.id, true));
        relatedList.appendChild(button);
      });
      els.detail.appendChild(relatedList);
    }

    updateHash(condition.id);
  }

  function selectCondition(id, ensureVisible = false) {
    state.activeId = id;
    renderList();
    renderDetail();
    if (ensureVisible) {
      const active = els.list.querySelector(".condition-row.active");
      active?.scrollIntoView({ block: "nearest" });
    }
    if (window.matchMedia("(max-width: 900px)").matches) {
      els.detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function init() {
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      state.all = (payload.conditions || []).sort((a, b) => a.nameZh.localeCompare(b.nameZh, "zh-CN"));
      state.filtered = [...state.all];
      els.generalRule.textContent = payload.generalRule || "";
      els.count.textContent = `共收录 ${state.all.length} 个状态`;
      setActiveIdFromHash();
      if (!state.activeId) state.activeId = state.all[0]?.id || null;
      renderCategories();
      applyFilters();
    } catch (error) {
      console.error(error);
      els.count.textContent = "状态数据加载失败";
      els.generalRule.textContent = "请确认 assets/data/conditions.json 存在，并通过本项目的 HTTP 服务打开页面。";
      els.list.appendChild(createTextElement("div", "no-results", "无法加载状态数据。"));
    }
  }

  els.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    applyFilters();
  });
  els.clear.addEventListener("click", () => {
    state.query = "";
    els.search.value = "";
    els.search.focus();
    applyFilters();
  });
  window.addEventListener("hashchange", () => {
    setActiveIdFromHash();
    renderList();
    renderDetail();
  });

  init();
})();
