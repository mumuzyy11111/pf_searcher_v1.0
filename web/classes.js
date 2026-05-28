(() => {
  const U = (hex) => hex.split(" ").filter(Boolean).map((h) => String.fromCodePoint(parseInt(h, 16))).join("");
  const T = {
    overview: U("6982 89c8"),
    advancement: U("6210 957f 8868"),
    features: U("6838 5fc3 804c 4e1a 7279 6027"),
    specials: U("53ef 9009 80fd 529b 4f53 7cfb"),
    favored: U("5929 8d4b 804c 4e1a 5956 52b1"),
    archetypes: U("804c 4e1a 53d8 4f53"),
    classLabel: U("804c 4e1a"),
    unnamedClass: U("672a 547d 540d 804c 4e1a"),
    unchained: U("6389 94fe 5b50"),
    unnamed: U("672a 547d 540d"),
    noTable: U("65e0 8868 683c 6570 636e 3002"),
    loadFail: U("52a0 8f7d 5931 8d25"),
    classLoadFail: U("804c 4e1a 6570 636e 52a0 8f7d 5931 8d25 3002"),
    noClassData: U("6ca1 6709 804c 4e1a 6570 636e 3002"),
    noMatchClass: U("6ca1 6709 5339 914d 804c 4e1a 3002"),
    uncategorized: U("672a 5206 7c7b"),
    match: U("5339 914d"),
    countClass: U("4e2a 804c 4e1a"),
    totalPrefix: U("5171"),
    archetypeCount: U("4e2a 804c 4e1a 53d8 4f53"),
    featureShort: U("7279 6027"),
    specialShort: U("7279 6b8a"),
    optionalShort: U("53ef 9009"),
    sourcePage: U("6765 6e90 9875"),
    intro: U("7b80 4ecb"),
    baseInfo: U("57fa 7840 4fe1 606f"),
    progression: U("804c 4e1a 8fdb 5ea6 8868"),
    role: U("89d2 8272 5b9a 4f4d"),
    alignment: U("9635 8425"),
    hitDie: U("751f 547d 9ab0"),
    wealth: U("8d77 59cb 8d44 91d1"),
    skills: U("672c 804c 6280 80fd"),
    skillRanks: U("5347 7ea7 6280 80fd 70b9 6570"),
    parentClasses: U("6e90 804c 4e1a"),
    emptyOverview: U("6982 89c8 5c55 793a 804c 4e1a 7b80 4ecb 3001 57fa 7840 4fe1 606f 548c 804c 4e1a 8fdb 5ea6 8868 3002 5176 4ed6 9644 8868 4f1a 4f5c 4e3a 5bf9 5e94 5b50 9879 663e 793a 3002"),
    emptyAdvancement: U("6210 957f 8868 5728 53f3 4fa7 663e 793a 3002"),
    noTabContent: U("5f53 524d 6807 7b7e 6ca1 6709 53ef 5c55 793a 5185 5bb9 3002"),
    noSpecialGroups: U("6682 65e0 7279 6b8a 80fd 529b 3002"),
    rulesText: U("89c4 5219 6b63 6587"),
    groupIntro: U("7ec4 8bf4 660e"),
    itemCount: U("6761 76ee"),
    prerequisites: U("5148 51b3 6761 4ef6"),
    effect: U("6548 679c"),
    special: U("7279 6b8a"),
    source: U("6765 6e90"),
    replaceAdjust: U("53d6 4ee3 002f 8c03 6574 ff1a"),
    favoredTitle: U("53ef 9009 5929 8d4b 804c 4e1a 5956 52b1"),
    classOption: U("804c 4e1a 53ef 9009 9879"),
    byRace: U("6309 79cd 65cf 5217 51fa"),
    raceOptions: U("4e2a 79cd 65cf 9009 9879"),
    relatedTable: U("76f8 5173 8868 683c"),
    variantFeatures: U("53d8 4f53 7279 6027"),
    noVariantFeatures: U("672a 63d0 53d6 5230 53d8 4f53 7279 6027 3002"),
    attachedTables: U("9644 8868"),
    lParen: U("ff08"),
    rParen: U("ff09"),
    comma: U("ff0c"),
    listSep: U("3001"),
    tablePrefix: U("8868 ff1a"),
    baseClasses: U("57fa 7840 804c 4e1a"),
    prestigeClasses: U("8fdb 9636 804c 4e1a"),
    mythicPaths: U("795e 8bdd 9053 9014"),
  };

  const totalEl = document.getElementById("total-count");
  const resultCountEl = document.getElementById("result-count");
  const searchEl = document.getElementById("class-search");
  const clearBtn = document.getElementById("clear-search");
  const sectionSwitchEl = document.getElementById("class-section-switch");
  const classListEl = document.getElementById("class-list");
  const titleEl = document.getElementById("class-title");
  const subtabsEl = document.getElementById("class-subtabs");
  const itemsEl = document.getElementById("class-items");
  const detailEl = document.getElementById("class-detail");

  const TAB_LABELS = { overview: T.overview, advancement: T.advancement, features: T.features, specials: T.specials, favored: T.favored, archetypes: T.archetypes };
  const CLASS_SECTIONS = [
    ["base", T.baseClasses],
    ["prestige", T.prestigeClasses],
    ["mythic", T.mythicPaths],
  ];
  const OPTION_KEYWORDS = [
    "72c2 66b4 4e4b 529b", "5965 672f 5b66 6d3e", "5b66 6d3e", "9886 57df", "5b50 57df", "8840 7edf",
    "5965 79d8", "542f 793a", "79d1 7814 53d1 73b0", "53d1 73b0", "6e38 8361 8005 5929 8d4b",
    "5fcd 6cd5", "5965 80fd", "5ba1 5224 57df", "9b54 5ba0", "5e7b 7075", "6b66 5668 8bad 7ec3",
    "793e 4f1a 5929 8d4b", "4fa0 5ba2 5929 8d4b", "5929 8d4b", "6280 6cd5", "9b54 6218 58eb 5965 80fd",
    "7075 5668", "7075 5668 4e4b 529b", "5fc3 667a", "8a93 7ea6", "795d 798f", "81ea 7136 5316 8eab",
    "52a8 7269 4f19 4f34", "52a8 7269 4e4b 529b",
  ].map(U);
  const FAVORED_RACES = new Set([
    "77ee 4eba", "7cbe 7075", "4f8f 5112", "534a 7cbe 7075", "534a 8eab 4eba", "534a 517d 4eba",
    "4eba 7c7b", "5730 7cbe", "517d 4eba", "9f20 65cf", "5929 72d7", "9e2e 5f62 4eba", "795e 88d4",
    "732b 65cf", "5353 5c14", "7a83 5f71 9b3c", "706b 5143 7d20 88d4", "72d7 5934 4eba",
    "98ce 5143 7d20 88d4", "9b54 88d4", "6c34 5143 7d20 88d4", "534a 9c7c 4eba", "72d0 5996",
    "4eba 9c7c", "876e 8840 88d4", "526a 5f71 4eba", "5438 8840 88d4", "5927 5730 7cbe",
    "571f 5143 7d20 88d4", "7070 77ee 4eba",
  ].map(U));

  let classes = [];
  let archetypes = [];
  let archetypesByClass = new Map();
  let selectedClassId = "";
  let activeClassSection = "base";
  let activeTab = "overview";
  let selectedItemId = "";

  const escapeHtml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const normalize = (value) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  const displayClassName = (item) => {
    const base = item.name_cn && item.name_en ? `${item.name_cn}${T.lParen}${item.name_en}${T.rParen}` : (item.name_cn || item.name_en || item.name_raw || T.unnamedClass);
    return item.category && item.category.includes("Unchained") ? `${base} / ${T.unchained}` : base;
  };
  const displayFeatureName = (feature) => {
    if (!feature) return T.unnamed;
    if (feature.name_cn && feature.name_en) {
      const type = feature.ability_type ? `${T.comma}${feature.ability_type}` : "";
      return `${feature.name_cn}${T.lParen}${feature.name_en}${type}${T.rParen}`;
    }
    return feature.name || feature.name_cn || feature.name_en || T.unnamed;
  };
  const displaySpecialOptionName = (option) => {
    if (!option) return T.unnamed;
    if (option.name_cn && option.name_en) {
      const type = option.ability_type ? `${T.comma}${option.ability_type}` : "";
      return `${option.name_cn}${T.lParen}${option.name_en}${type}${T.rParen}`;
    }
    return option.name || option.name_cn || option.name_en || T.unnamed;
  };
  const getSpecialOptionMainText = (option) => option && (option.effect || option.detail_text || "");
  const getClassArchetypes = (classId) => archetypesByClass.get(classId) || [];
  const getClassSection = (cls) => cls && cls.type === "prestige_class" ? "prestige" : (cls && cls.type === "mythic_path" ? "mythic" : "base");
  const getSectionClasses = () => classes.filter((cls) => getClassSection(cls) === activeClassSection);
  const getSelectedClass = () => getSectionClasses().find((item) => item.class_id === selectedClassId) || getSectionClasses()[0] || null;
  const getSpecialGroups = (cls) => {
    const profileGroups = cls && cls.class_profile && cls.class_profile.choice_systems && cls.class_profile.choice_systems.groups;
    if (Array.isArray(profileGroups)) return profileGroups;
    return Array.isArray(cls && cls.special_ability_groups) ? cls.special_ability_groups : [];
  };
  const getSpecialOptionCount = (cls) => getSpecialGroups(cls).reduce((sum, group) => sum + (Array.isArray(group.options) ? group.options.length : 0), 0);
  const isFavoredClassOption = (feature) => FAVORED_RACES.has(String(feature.name_cn || feature.name || "").trim());
  const getProfileItems = (cls, section) => {
    const items = cls && cls.class_profile && cls.class_profile[section] && cls.class_profile[section].items;
    return Array.isArray(items) ? items : null;
  };
  const getFavoredClassOptions = (cls) => {
    const profileItems = getProfileItems(cls, "favored_class_options");
    if (profileItems) return profileItems;
    return (cls.features || []).filter(isFavoredClassOption);
  };
  const getCoreFeatures = (cls) => {
    const profileItems = getProfileItems(cls, "core_features");
    if (profileItems) return profileItems;
    return (cls.features || []).filter((feature) => !isFavoredClassOption(feature));
  };
  const isOptionalFeature = (feature, cls) => {
    if (isFavoredClassOption(feature)) return false;
    const text = [feature.name, feature.name_cn, feature.name_en, feature.text, cls && cls.name_cn, cls && cls.name_en].join(" ");
    return OPTION_KEYWORDS.some((keyword) => text.includes(keyword));
  };
  const isOptionTable = (table, cls) => {
    const title = String(table && table.title || "");
    if (!title) return true;
    const baseTitle = `${T.tablePrefix}${cls && cls.name_cn ? cls.name_cn : ""}`;
    return title.replace(/\s+/g, "") !== baseTitle.replace(/\s+/g, "");
  };
  const cleanAttachText = (value, cls) => String(value || "")
    .replace(/\s+/g, "")
    .replace(T.tablePrefix, "")
    .replace(cls && cls.name_cn ? cls.name_cn : "", "")
    .replace(/[()\uFF08\uFF09:\uFF1A,\uFF0C.\u3002;\uFF1B"\u201C\u201D'\u2018\u2019\[\]\u3010\u3011\u300A\u300B<>]/g, "")
    .toLowerCase();
  const scoreTableFeature = (table, feature, cls) => {
    const title = cleanAttachText(table && table.title, cls);
    const name = cleanAttachText(feature && (feature.name_cn || feature.name || feature.name_en), cls);
    const text = cleanAttachText(feature && feature.text, cls);
    if (!title || !name) return 0;
    let score = 0;
    if (title.includes(name) || name.includes(title)) score += 100 + Math.min(title.length, name.length);
    if (text && text.includes(title)) score += 40;
    const pairs = [
      [U("9b54 5ba0"), U("9b54 5ba0")],
      [U("6cd5 672f"), U("6cd5 672f")],
      [U("53ef 77e5 6cd5 672f 6570 91cf"), U("6cd5 672f")],
      [U("5df2 77e5 6cd5 672f 6570 91cf"), U("6cd5 672f")],
      [U("51c6 5907 6cd5 672f 6570 91cf"), U("6cd5 672f")],
      [U("5bbf 654c"), U("5bbf 654c")],
      [U("504f 597d 5730 5f62"), U("504f 597d 5730 5f62")],
      [U("65a7 7c7b"), U("6b66 5668 8bad 7ec3")],
      [U("6b66 5668"), U("6b66 5668 8bad 7ec3")],
    ];
    pairs.forEach(([tableKey, featureKey]) => {
      if (title.includes(tableKey) && (name.includes(featureKey) || text.includes(featureKey))) score += 80;
    });
    return score;
  };
  const buildTableAssignments = (cls, features) => {
    const assignments = new Map();
    (features || []).forEach((feature) => assignments.set(feature, []));
    (cls.tables || []).filter((table) => isOptionTable(table, cls)).forEach((table) => {
      let bestFeature = null;
      let bestScore = 0;
      (features || []).forEach((feature) => {
        const score = scoreTableFeature(table, feature, cls);
        if (score > bestScore) {
          bestScore = score;
          bestFeature = feature;
        }
      });
      if (bestFeature) assignments.get(bestFeature).push(table);
    });
    return assignments;
  };

  const stripDuplicateTitleRow = (rows, title) => {
    const cleanRows = Array.isArray(rows) ? rows.filter((row) => Array.isArray(row) && row.length) : [];
    if (!cleanRows.length) return [];
    return title && cleanRows[0].every((cell) => String(cell || "") === title) ? cleanRows.slice(1) : cleanRows;
  };
  const renderTable = (table, limit = 100) => {
    const title = table && table.title ? String(table.title) : "";
    const sourceRows = table && Array.isArray(table.headers) && table.headers.length ? [table.headers, ...(Array.isArray(table.rows) ? table.rows : [])] : (table && table.rows);
    const rows = stripDuplicateTitleRow(sourceRows, title).slice(0, limit);
    if (!rows.length) return `<div class="empty-list">${T.noTable}</div>`;
    const maxCols = Math.max(...rows.map((row) => row.length));
    const body = rows.map((row, rowIndex) => {
      const tag = rowIndex === 0 ? "th" : "td";
      const cells = [];
      for (let i = 0; i < maxCols; i += 1) cells.push(`<${tag}>${escapeHtml(row[i] || "")}</${tag}>`);
      return `<tr>${cells.join("")}</tr>`;
    }).join("");
    return `<div class="attached-table">${title ? `<div class="attached-table-title">${escapeHtml(title)}</div>` : ""}<table>${body}</table></div>`;
  };
  const textBlock = (title, value) => {
    const text = String(value || "").trim();
    return text ? `<div class="detail-section"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(text)}</p></div>` : "";
  };

  const getFavoredItems = (cls) => {
    const favored = getFavoredClassOptions(cls);
    return favored.map((option, index) => ({
      id: `favored-${index}`,
      kind: "favoredOption",
      title: option.name_cn || option.name || T.unnamed,
      subtitle: T.favoredTitle,
      summary: option.text || "",
      option,
    }));
  };

  const classMatches = (cls, query) => {
    if (!query) return true;
    const clsArchetypes = getClassArchetypes(cls.class_id);
    const specialText = getSpecialGroups(cls).map((group) => `${group.title} ${group.intro} ${(group.options || []).map((o) => `${o.name_cn} ${o.name_en} ${o.prerequisites} ${o.effect} ${o.special} ${o.detail_text}`).join(" ")}`).join(" ");
    const text = [cls.name_cn, cls.name_en, cls.name_raw, cls.category, cls.intro, JSON.stringify(cls.metadata || {}), (cls.features || []).map((f) => `${f.name} ${f.name_cn} ${f.name_en} ${f.text}`).join(" "), specialText, clsArchetypes.map((a) => `${a.name_raw} ${a.name_cn} ${a.name_en} ${a.description} ${(a.features || []).map((f) => `${f.name} ${f.text}`).join(" ")}`).join(" ")].join(" ");
    return normalize(text).includes(query);
  };
  const categoryRank = (category) => {
    const text = String(category || "");
    if (text.startsWith(U("8fdb 9636 804c 4e1a"))) return 0;
    return 1;
  };

  const loadData = async () => {
    const resp = await fetch(`/result/classes/classes-extracted.json?v=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) throw new Error(T.loadFail);
    const data = await resp.json();
    classes = Array.isArray(data.classes) ? data.classes : [];
    archetypes = Array.isArray(data.archetypes) ? data.archetypes : [];
    archetypesByClass = new Map();
    archetypes.forEach((item) => {
      const classId = item.parent_class && item.parent_class.class_id;
      if (!classId) return;
      if (!archetypesByClass.has(classId)) archetypesByClass.set(classId, []);
      archetypesByClass.get(classId).push(item);
    });
    selectedClassId = getSectionClasses()[0] ? getSectionClasses()[0].class_id : "";
    const counts = CLASS_SECTIONS.map(([key, label]) => `${label} ${classes.filter((cls) => getClassSection(cls) === key).length}`).join(" / ");
    totalEl.textContent = `${T.totalPrefix} ${classes.length} ${T.countClass}${T.comma}${counts}${T.comma}${archetypes.length} ${T.archetypeCount}`;
  };

  const renderSectionSwitch = () => {
    sectionSwitchEl.innerHTML = "";
    CLASS_SECTIONS.forEach(([key, label]) => {
      const count = classes.filter((cls) => getClassSection(cls) === key).length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `class-section-option${activeClassSection === key ? " active" : ""}`;
      btn.innerHTML = `${escapeHtml(label)} <span>${count}</span>`;
      btn.addEventListener("click", () => {
        if (activeClassSection === key) return;
        activeClassSection = key;
        const sectionItems = getSectionClasses();
        selectedClassId = sectionItems[0] ? sectionItems[0].class_id : "";
        activeTab = "overview";
        selectedItemId = "";
        render();
      });
      sectionSwitchEl.appendChild(btn);
    });
  };

  const renderClassList = () => {
    const query = normalize(searchEl.value);
    const sectionItems = getSectionClasses();
    const visible = sectionItems.filter((cls) => classMatches(cls, query));
    if (visible.length && !visible.some((cls) => cls.class_id === selectedClassId)) {
      selectedClassId = visible[0].class_id;
      activeTab = "overview";
      selectedItemId = "";
    }
    const grouped = new Map();
    visible.forEach((cls) => {
      const category = cls.category || T.uncategorized;
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(cls);
    });
    resultCountEl.textContent = query ? `${T.match} ${visible.length} ${T.countClass}` : "";
    classListEl.innerHTML = "";
    if (!visible.length) {
      classListEl.innerHTML = `<div class="empty-list">${T.noMatchClass}</div>`;
      return;
    }
    Array.from(grouped.entries())
      .sort(([a], [b]) => categoryRank(a) - categoryRank(b) || String(a).localeCompare(String(b), "zh-Hans-CN"))
      .forEach(([category, items]) => {
      const heading = document.createElement("div");
      heading.className = "class-group-title";
      heading.textContent = `${category} (${items.length})`;
      classListEl.appendChild(heading);
      items.forEach((cls) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `book-tab class-tab${cls.class_id === selectedClassId ? " active" : ""}`;
        btn.innerHTML = `<span>${escapeHtml(displayClassName(cls))}</span><em>${getClassArchetypes(cls.class_id).length}</em>`;
        btn.addEventListener("click", () => { selectedClassId = cls.class_id; activeTab = "overview"; selectedItemId = ""; render(); });
        classListEl.appendChild(btn);
      });
    });
  };

  const getTabCounts = (cls) => ({ overview: 1, advancement: cls.progression_table ? 1 : 0, features: getCoreFeatures(cls).length, specials: getSpecialOptionCount(cls), favored: getFavoredItems(cls).length, archetypes: getClassArchetypes(cls.class_id).length });
  const renderSubtabs = (cls) => {
    const counts = getTabCounts(cls);
    subtabsEl.innerHTML = "";
    Object.entries(TAB_LABELS).forEach(([tab, label]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `class-subtab${activeTab === tab ? " active" : ""}`;
      btn.innerHTML = `${escapeHtml(label)} <span>${counts[tab] || 0}</span>`;
      btn.addEventListener("click", () => { activeTab = tab; selectedItemId = ""; renderContent(); });
      subtabsEl.appendChild(btn);
    });
  };
  const renderClassTitle = (cls) => {
    titleEl.innerHTML = `<div class="detail-kicker">${escapeHtml(cls.category || T.classLabel)}</div><h2>${escapeHtml(displayClassName(cls))}</h2><div class="class-title-meta"><span>${T.featureShort} ${getCoreFeatures(cls).length}</span><span>${T.specialShort} ${getSpecialOptionCount(cls)}</span><span>${T.favored} ${getFavoredClassOptions(cls).length}</span><span>${T.archetypes} ${getClassArchetypes(cls.class_id).length}</span><span>${T.sourcePage} ${escapeHtml(cls.source_page || "-")}</span></div>`;
  };
  const renderItemButton = (item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `feat-row class-item-row${selectedItemId === item.id ? " active" : ""}`;
    btn.innerHTML = `<span class="feat-row-title">${escapeHtml(item.title)}</span><span class="feat-row-book">${escapeHtml(item.subtitle || "")}</span>${item.summary ? `<span class="feat-row-summary">${escapeHtml(item.summary)}</span>` : ""}`;
    btn.addEventListener("click", () => { selectedItemId = item.id; renderContent(); });
    return btn;
  };
  const renderItems = (items, emptyText) => {
    itemsEl.innerHTML = "";
    if (!items.length) { itemsEl.innerHTML = `<div class="empty-list">${escapeHtml(emptyText)}</div>`; return; }
    items.forEach((item) => itemsEl.appendChild(renderItemButton(item)));
  };

  const renderOverviewDetail = (cls) => {
    const metadata = cls.metadata || {};
    const metaRows = [[T.role, metadata.role], [T.alignment, metadata.alignment], [T.hitDie, metadata.hit_die], [T.wealth, metadata.starting_wealth], [T.skills, metadata.class_skills], [T.skillRanks, metadata.skill_ranks_per_level], [T.parentClasses, metadata.parent_classes]].filter(([, value]) => String(value || "").trim());
    detailEl.innerHTML = `<article class="feat-detail-card"><div class="detail-kicker">${escapeHtml(cls.category || T.classLabel)}</div><h2>${escapeHtml(displayClassName(cls))}</h2>${textBlock(T.intro, cls.intro)}${metaRows.length ? `<div class="detail-section"><h4>${T.baseInfo}</h4><div class="class-meta-grid">${metaRows.map(([k, v]) => `<div><strong>${escapeHtml(k)}</strong><span>${escapeHtml(v)}</span></div>`).join("")}</div></div>` : ""}</article>`;
  };
  const renderAdvancementDetail = (cls) => {
    detailEl.innerHTML = `<article class="feat-detail-card"><div class="detail-kicker">${escapeHtml(cls.category || T.classLabel)}</div><h2>${escapeHtml(T.advancement)}</h2>${cls.progression_table ? `<div class="detail-section"><h4>${T.progression}</h4>${renderTable(cls.progression_table, 40)}</div>` : `<div class="empty-detail">${T.noTable}</div>`}</article>`;
  };
  const renderFeatureDetail = (item) => {
    const f = item.feature;
    const attachedTables = Array.isArray(item.tables) && item.tables.length ? `<div class="detail-section"><h4>${T.attachedTables}</h4>${item.tables.map((table) => renderTable(table, 120)).join("")}</div>` : "";
    detailEl.innerHTML = `<article class="feat-detail-card"><div class="detail-kicker">${escapeHtml(item.subtitle || T.features)}</div><h2>${escapeHtml(displayFeatureName(f))}</h2>${f.replaces && f.replaces.length ? `<div class="type-badges">${f.replaces.map((r) => `<span class="type-badge">${T.replaceAdjust}${escapeHtml(r)}</span>`).join("")}</div>` : ""}${textBlock(T.rulesText, f.text)}${attachedTables}</article>`;
  };
  const renderFavoredDetail = (item) => {
    detailEl.innerHTML = `<article class="feat-detail-card"><div class="detail-kicker">${T.classOption}</div><h2>${T.favoredTitle}</h2><div class="detail-section"><h4>${T.byRace}</h4><div class="favored-list">${item.options.map((option) => `<section class="feature-block favored-option"><h5>${escapeHtml(option.name_cn || option.name || T.unnamed)}</h5><p>${escapeHtml(option.text || "")}</p></section>`).join("")}</div></div></article>`;
  };
  const renderFavoredOptionDetail = (item) => {
    const option = item.option || {};
    detailEl.innerHTML = `<article class="feat-detail-card"><div class="detail-kicker">${T.favoredTitle}</div><h2>${escapeHtml(option.name_cn || option.name || T.unnamed)}</h2>${textBlock(T.rulesText, option.text || "")}</article>`;
  };
  const renderSpecialGroupDetail = (item) => {
    const group = item.group;
    const options = Array.isArray(group.options) ? group.options : [];
    const optionHtml = options.map((option) => {
      const title = displaySpecialOptionName(option);
      const badges = [option.source_book ? `${T.source}${T.comma}${option.source_book}` : "", option.prerequisites ? `${T.prerequisites}${T.comma}${option.prerequisites}` : ""].filter(Boolean);
      const mainText = getSpecialOptionMainText(option);
      return `<section class="feature-block"><h5>${escapeHtml(title)}</h5>${badges.length ? `<div class="type-badges">${badges.map((badge) => `<span class="type-badge">${escapeHtml(badge)}</span>`).join("")}</div>` : ""}${mainText ? `<p>${escapeHtml(mainText)}</p>` : ""}${option.special ? `<p><strong>${T.special}${T.comma}</strong>${escapeHtml(option.special)}</p>` : ""}</section>`;
    }).join("");
    detailEl.innerHTML = `<article class="feat-detail-card"><div class="detail-kicker">${escapeHtml(group.source_page || T.specials)}</div><h2>${escapeHtml(group.title || T.specials)}</h2>${textBlock(T.groupIntro, group.intro)}<div class="detail-section"><h4>${T.specials}</h4><div class="favored-list">${optionHtml || `<p>${T.noSpecialGroups}</p>`}</div></div></article>`;
  };
  const renderSpecialOptionDetail = (item) => {
    const option = item.option || {};
    const group = item.group || {};
    const badges = [option.source_book ? `${T.source}${T.comma}${option.source_book}` : "", option.prerequisites ? `${T.prerequisites}${T.comma}${option.prerequisites}` : ""].filter(Boolean);
    const mainText = getSpecialOptionMainText(option);
    detailEl.innerHTML = `<article class="feat-detail-card"><div class="detail-kicker">${escapeHtml(group.title || T.specials)}</div><h2>${escapeHtml(displaySpecialOptionName(option))}</h2>${badges.length ? `<div class="type-badges">${badges.map((badge) => `<span class="type-badge">${escapeHtml(badge)}</span>`).join("")}</div>` : ""}${textBlock(T.groupIntro, group.intro)}${textBlock(T.rulesText, mainText)}${option.special ? `<div class="detail-section"><h4>${T.special}</h4><p>${escapeHtml(option.special)}</p></div>` : ""}</article>`;
  };
  const renderArchetypeDetail = (item) => {
    const a = item.archetype;
    const features = Array.isArray(a.features) ? a.features : [];
    detailEl.innerHTML = `<article class="feat-detail-card"><div class="detail-kicker">${escapeHtml(a.source_book || T.archetypes)}</div><h2>${escapeHtml(a.name_cn && a.name_en ? `${a.name_cn}${T.lParen}${a.name_en}${T.rParen}` : (a.name_raw || a.name_cn || a.name_en))}</h2>${textBlock(T.intro, a.description)}<div class="detail-section"><h4>${T.variantFeatures}</h4>${features.length ? features.map((f) => `<section class="feature-block"><h5>${escapeHtml(displayFeatureName(f))}</h5>${f.replaces && f.replaces.length ? `<div class="type-badges">${f.replaces.map((r) => `<span class="type-badge">${T.replaceAdjust}${escapeHtml(r)}</span>`).join("")}</div>` : ""}<p>${escapeHtml(f.text || "")}</p></section>`).join("") : `<p>${T.noVariantFeatures}</p>`}</div>${Array.isArray(a.tables) && a.tables.length ? `<div class="detail-section"><h4>${T.attachedTables}</h4>${a.tables.map((table) => renderTable(table)).join("")}</div>` : ""}</article>`;
  };
  const renderSelectedDetail = (cls, items) => {
    if (activeTab === "overview") { renderOverviewDetail(cls); return; }
    if (activeTab === "advancement") { renderAdvancementDetail(cls); return; }
    const selected = items.find((item) => item.id === selectedItemId) || items[0];
    if (!selected) { detailEl.innerHTML = `<div class="empty-detail">${T.noTabContent}</div>`; return; }
    selectedItemId = selected.id;
    if (selected.kind === "feature") renderFeatureDetail(selected);
    else if (selected.kind === "favored") renderFavoredDetail(selected);
    else if (selected.kind === "favoredOption") renderFavoredOptionDetail(selected);
    else if (selected.kind === "specialGroup") renderSpecialGroupDetail(selected);
    else if (selected.kind === "specialOption") renderSpecialOptionDetail(selected);
    else if (selected.kind === "archetype") renderArchetypeDetail(selected);
  };
  const buildItemsForTab = (cls) => {
    if (activeTab === "features") {
      const coreFeatures = getCoreFeatures(cls);
      const tableAssignments = buildTableAssignments(cls, coreFeatures);
      return coreFeatures.map((feature, index) => ({ id: `feature-${index}`, kind: "feature", title: displayFeatureName(feature), subtitle: T.features, summary: feature.text || "", feature, tables: tableAssignments.get(feature) || [] }));
    }
    if (activeTab === "specials") {
      const rows = [];
      getSpecialGroups(cls).forEach((group, groupIndex) => {
        const options = Array.isArray(group.options) ? group.options : [];
        if (!options.length) {
          rows.push({ id: `special-${groupIndex}`, kind: "specialGroup", title: group.title || T.specials, subtitle: `0 ${T.itemCount}`, summary: group.intro || "", group });
          return;
        }
        options.forEach((option, optionIndex) => {
          rows.push({
            id: `special-${groupIndex}-${optionIndex}`,
            kind: "specialOption",
            title: displaySpecialOptionName(option),
            subtitle: group.title || T.specials,
            summary: getSpecialOptionMainText(option),
            group,
            option,
          });
        });
      });
      return rows;
    }
    if (activeTab === "favored") return getFavoredItems(cls);
    if (activeTab === "archetypes") return getClassArchetypes(cls.class_id).map((archetype, index) => ({ id: `archetype-${index}`, kind: "archetype", title: archetype.name_cn && archetype.name_en ? `${archetype.name_cn}${T.lParen}${archetype.name_en}${T.rParen}` : (archetype.name_raw || archetype.name_cn || archetype.name_en), subtitle: archetype.source_book || T.archetypes, summary: archetype.description || "", archetype }));
    return [];
  };
  const renderContent = () => {
    const cls = getSelectedClass();
    if (!cls) { titleEl.innerHTML = ""; subtabsEl.innerHTML = ""; itemsEl.innerHTML = ""; detailEl.innerHTML = `<div class="empty-detail">${T.noClassData}</div>`; return; }
    if (!TAB_LABELS[activeTab]) activeTab = "overview";
    renderClassTitle(cls);
    renderSubtabs(cls);
    if (activeTab === "overview") { itemsEl.innerHTML = `<div class="empty-list">${T.emptyOverview}</div>`; renderOverviewDetail(cls); return; }
    if (activeTab === "advancement") { itemsEl.innerHTML = `<div class="empty-list">${T.emptyAdvancement}</div>`; renderAdvancementDetail(cls); return; }
    const items = buildItemsForTab(cls);
    if (items.length && !items.some((item) => item.id === selectedItemId)) selectedItemId = items[0].id;
    renderItems(items, T.noTabContent);
    renderSelectedDetail(cls, items);
  };
  const render = () => { renderSectionSwitch(); renderClassList(); renderContent(); };

  searchEl.addEventListener("input", () => {
    const query = normalize(searchEl.value);
    const visible = getSectionClasses().filter((cls) => classMatches(cls, query));
    if (query && visible.length && !visible.some((cls) => cls.class_id === selectedClassId)) { selectedClassId = visible[0].class_id; activeTab = "overview"; selectedItemId = ""; }
    render();
  });
  clearBtn.addEventListener("click", () => { searchEl.value = ""; render(); searchEl.focus(); });
  loadData().then(render).catch((err) => { totalEl.textContent = T.loadFail; resultCountEl.textContent = String(err.message || err); detailEl.innerHTML = `<div class="empty-detail">${T.classLoadFail}</div>`; });
})();
