(() => {
  const modeEl = document.getElementById("search-mode");
  const inputEl = document.getElementById("search-input");
  const btnEl = document.getElementById("search-btn");
  const totalEl = document.getElementById("total-count");
  const resultCountEl = document.getElementById("result-count");
  const resultsEl = document.getElementById("results");

  const MAX_RENDER = 200;
  let spells = [];

  const normalize = (v) => String(v || "").toLowerCase().replace(/\s+/g, " ").trim();

  const cnNameFromRaw = (raw) => {
    const text = String(raw || "").trim();
    const m = text.match(/^(.+?)\s*[（(][^()（）]+[）)]\s*$/);
    if (m && /[\u4e00-\u9fff]/.test(m[1])) return m[1].trim();
    return text;
  };

  const normalizeSpell = (row, sourceHint) => {
    const name = row.name_zh || row["名称"] || cnNameFromRaw(row.name) || "(未命名)";
    const source = String(row["来源"] || row.source_book || sourceHint || "").toUpperCase();
    const school = row["学派"] || row.school || "";
    const level = row["等级"] || row.level_raw || "";
    const effect = row["法术效果"] || row.effect || (row.raw_fields && row.raw_fields["效果"]) || "";
    const id = row.spell_id || `${source}:${name}:${level}`;
    return {
      id,
      name,
      nameRaw: row.name || "",
      source,
      school,
      level,
      effect,
      raw: row,
    };
  };

  const getSpellSources = async () => {
    const resp = await fetch("/api/spell-sources");
    if (!resp.ok) throw new Error("加载法术源失败");
    const data = await resp.json();
    return (data.sources || []).map((s) => ({ source: s.source, path: s.path }));
  };

  const loadSpells = async () => {
    const sources = await getSpellSources();
    const loaded = await Promise.all(
      sources.map(async (src) => {
        try {
          const resp = await fetch(src.path);
          if (!resp.ok) return [];
          const arr = await resp.json();
          if (!Array.isArray(arr)) return [];
          return arr.map((row) => normalizeSpell(row, src.source));
        } catch {
          return [];
        }
      })
    );
    const merged = loaded.flat();
    const dedup = new Map();
    merged.forEach((item) => {
      if (!dedup.has(item.id)) dedup.set(item.id, item);
    });
    spells = Array.from(dedup.values());
    totalEl.textContent = `共 ${spells.length} 条法术`;
  };

  const spellMatches = (item, query, mode) => {
    if (!query) return true;
    if (mode === "name") {
      return normalize(item.name).includes(query) || normalize(item.nameRaw).includes(query);
    }
    return normalize(JSON.stringify(item.raw)).includes(query);
  };

  const render = (rows) => {
    resultsEl.innerHTML = "";
    if (!rows.length) {
      resultsEl.innerHTML = '<div class="card">没有匹配结果。</div>';
      return;
    }
    rows.slice(0, MAX_RENDER).forEach((item) => {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <h3>${item.name}</h3>
        <div class="meta">来源：${item.source || "-"} ｜ 学派：${item.school || "-"}</div>
        <div class="meta">等级：${item.level || "-"}</div>
        <div class="block">${item.effect || "无效果描述"}</div>
      `;
      resultsEl.appendChild(card);
    });
  };

  const doSearch = () => {
    const mode = modeEl.value;
    const query = normalize(inputEl.value);
    const rows = spells.filter((item) => spellMatches(item, query, mode));
    resultCountEl.textContent = `匹配 ${rows.length} 条${rows.length > MAX_RENDER ? `，仅展示前 ${MAX_RENDER} 条` : ""}`;
    render(rows);
  };

  modeEl.addEventListener("change", () => {
    inputEl.placeholder = modeEl.value === "name" ? "输入法术名称" : "输入关键词（在全部字段中匹配）";
    doSearch();
  });
  btnEl.addEventListener("click", doSearch);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  loadSpells()
    .then(doSearch)
    .catch((err) => {
      totalEl.textContent = "加载失败";
      resultCountEl.textContent = String(err.message || err);
      render([]);
    });
})();
