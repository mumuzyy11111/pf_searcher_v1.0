(() => {
  const PROFILES_KEY = "pf_status_tracker_profiles_v1";
  const ACTIVE_PROFILE_KEY = "pf_status_tracker_active_profile_v1";

  const SECTIONS = [
    ["basic", "基础数值", "记录 HP、防御、豁免、速度、攻击加值、CMB/CMD、先攻、种族和属性。"],
    ["classFeatures", "职业能力", "记录职业、等级，以及每一等级对应的职业能力。"],
    ["spells", "法术", "记录法术列表、法术位、法术 DC 和施法职业备注。"],
    ["feats", "当前专长", "记录当前专长与专长效果。"],
    ["buffs", "当前 Buff", "记录当前生效的 Buff、来源、持续时间和效果。"],
    ["companions", "其他生物", "记录召唤物、动物伙伴、魔宠、盟友等关键效果。"],
    ["items", "奇物", "记录当前拥有的奇物及其对应效果。"],
    ["notes", "剧情备注", "记录当前任务、NPC、线索、战利品和临时事项。"],
  ];

  const ABILITIES = [
    ["str", "力量 STR"],
    ["dex", "敏捷 DEX"],
    ["con", "体质 CON"],
    ["int", "智力 INT"],
    ["wis", "感知 WIS"],
    ["cha", "魅力 CHA"],
  ];

  const els = {
    saveStatus: document.getElementById("save-status"),
    profileSelect: document.getElementById("profile-select"),
    importInput: document.getElementById("import-profile-input"),
    sectionList: document.getElementById("section-list"),
    sectionTitle: document.getElementById("section-title"),
    sectionSubtitle: document.getElementById("section-subtitle"),
    profileSummary: document.getElementById("profile-summary"),
    content: document.getElementById("section-content"),
  };

  let activeSection = "basic";
  let activeDetailId = null;
  let profiles = loadProfiles();
  let activeProfileId = loadActiveProfileId(profiles);

  const listConfigs = {
    classFeatures: {
      title: "职业能力",
      empty: "还没有职业能力。可以按职业等级逐条记录。",
      addText: "添加职业能力",
      collection: "classFeatures",
      factory: () => ({
        id: makeId("class-feature"),
        className: "",
        classLevel: "",
        featureLevel: "",
        name: "",
        uses: "",
        effect: "",
        notes: "",
      }),
      fields: [
        ["className", "职业名"],
        ["classLevel", "职业等级", "number"],
        ["featureLevel", "获得等级", "number"],
        ["name", "能力名"],
        ["uses", "使用次数/资源"],
        ["effect", "效果", "textarea", "full"],
        ["notes", "备注", "textarea", "full"],
      ],
    },
    casters: {
      title: "施法职业与法术 DC",
      empty: "还没有施法职业。",
      addText: "添加施法职业",
      collection: "spells.casters",
      factory: () => ({
        id: makeId("caster"),
        className: "",
        casterLevel: "",
        keyAbility: "",
        concentration: "",
        spellDcBase: "",
        notes: "",
      }),
      fields: [
        ["className", "施法职业"],
        ["casterLevel", "施法者等级", "number"],
        ["keyAbility", "关键属性"],
        ["concentration", "专注加值", "number"],
        ["spellDcBase", "法术 DC 基础值", "number"],
        ["notes", "施法职业备注", "textarea", "full"],
      ],
    },
    spellSlots: {
      title: "法术位",
      empty: "还没有法术位记录。",
      addText: "添加法术位",
      collection: "spells.slots",
      factory: () => ({
        id: makeId("spell-slot"),
        className: "",
        spellLevel: "",
        daily: "",
        used: "",
        bonus: "",
        notes: "",
      }),
      fields: [
        ["className", "施法职业"],
        ["spellLevel", "环位", "number"],
        ["daily", "每日法术位", "number"],
        ["used", "已用法术位", "number"],
        ["bonus", "额外法术位", "number"],
        ["notes", "备注", "textarea", "full"],
      ],
    },
    knownSpells: {
      title: "法术列表",
      empty: "还没有法术记录。",
      addText: "添加法术",
      collection: "spells.known",
      factory: () => ({
        id: makeId("spell"),
        name: "",
        className: "",
        spellLevel: "",
        dcModifier: "",
        mode: "",
        effect: "",
        notes: "",
      }),
      fields: [
        ["name", "法术名"],
        ["className", "施法职业"],
        ["spellLevel", "环位", "number"],
        ["dcModifier", "法术 DC 修正", "number"],
        ["mode", "准备/已知/自发"],
        ["effect", "效果", "textarea", "full"],
        ["notes", "备注", "textarea", "full"],
      ],
    },
    feats: {
      title: "当前专长",
      empty: "还没有专长记录。",
      addText: "添加专长",
      collection: "feats",
      factory: () => ({
        id: makeId("feat"),
        name: "",
        type: "",
        source: "",
        alwaysOn: false,
        effect: "",
        notes: "",
      }),
      fields: [
        ["name", "专长名"],
        ["type", "类型"],
        ["source", "来源"],
        ["alwaysOn", "是否常驻", "checkbox"],
        ["effect", "专长效果", "textarea", "full"],
        ["notes", "备注", "textarea", "full"],
      ],
    },
    buffs: {
      title: "当前 Buff",
      empty: "还没有 Buff 记录。",
      addText: "添加 Buff",
      collection: "buffs",
      factory: () => ({
        id: makeId("buff"),
        name: "",
        source: "",
        duration: "",
        remaining: "",
        enabled: true,
        affectedStats: "",
        effect: "",
        notes: "",
      }),
      fields: [
        ["name", "Buff 名称"],
        ["source", "来源"],
        ["duration", "持续时间"],
        ["remaining", "剩余时间"],
        ["enabled", "是否启用", "checkbox"],
        ["affectedStats", "影响字段"],
        ["effect", "Buff 效果", "textarea", "full"],
        ["notes", "备注", "textarea", "full"],
      ],
    },
    companions: {
      title: "其他生物",
      empty: "还没有其他生物记录。",
      addText: "添加生物",
      collection: "companions",
      factory: () => ({
        id: makeId("creature"),
        name: "",
        type: "召唤物",
        hp: "",
        ac: "",
        attacks: "",
        saves: "",
        speed: "",
        abilities: "",
        currentState: "",
        notes: "",
      }),
      fields: [
        ["name", "名称"],
        ["type", "类型"],
        ["hp", "HP"],
        ["ac", "AC"],
        ["attacks", "攻击"],
        ["saves", "豁免"],
        ["speed", "速度"],
        ["abilities", "能力与效果", "textarea", "full"],
        ["currentState", "当前状态", "textarea", "full"],
        ["notes", "备注", "textarea", "full"],
      ],
    },
    items: {
      title: "奇物",
      empty: "还没有奇物记录。",
      addText: "添加奇物",
      collection: "items",
      factory: () => ({
        id: makeId("item"),
        name: "",
        slot: "",
        equipped: false,
        enabled: true,
        charges: "",
        effect: "",
        notes: "",
      }),
      fields: [
        ["name", "物品名"],
        ["slot", "部位"],
        ["equipped", "是否装备", "checkbox"],
        ["enabled", "是否启用", "checkbox"],
        ["charges", "使用次数/充能"],
        ["effect", "奇物对应效果", "textarea", "full"],
        ["notes", "备注", "textarea", "full"],
      ],
    },
  };

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function defaultProfile(name = "新角色") {
    return {
      id: makeId("status-profile"),
      name,
      updatedAt: new Date().toISOString(),
      basicStats: {
        identity: { characterName: name, playerName: "", race: "", size: "中型", classes: "", alignment: "" },
        hp: { max: "", hpMaxBase: "", current: "", temp: "", nonlethal: "", notes: "" },
        abilities: Object.fromEntries(ABILITIES.map(([key]) => [key, { base: "", enhancement: "", temporary: "", misc: "", notes: "" }])),
        ac: { base: "10", armor: "", shield: "", dex: "", natural: "", deflection: "", dodge: "", size: "", misc: "", notes: "" },
        saves: {
          fortBase: "", fortAbility: "", fortResistance: "", fortMagic: "", fortMisc: "",
          refBase: "", refAbility: "", refResistance: "", refMagic: "", refMisc: "",
          willBase: "", willAbility: "", willResistance: "", willMagic: "", willMisc: "",
        },
        attacks: { bab: "", melee: "", ranged: "", cmb: "", cmd: "", initiative: "", misc: "", notes: "" },
        speed: { land: "30", fly: "", swim: "", climb: "", burrow: "", notes: "" },
        detailModifiers: {},
      },
      classFeatures: [],
      spells: { casters: [], slots: [], known: [] },
      feats: [],
      buffs: [],
      companions: [],
      items: [],
      notes: { currentQuest: "", npcs: "", locations: "", clues: "", loot: "", todos: "", freeform: "" },
    };
  }

  function normalizeProfile(profile) {
    const base = defaultProfile(profile && profile.name ? profile.name : "新角色");
    const merged = deepMerge(base, profile && typeof profile === "object" ? profile : {});
    merged.id = merged.id || makeId("status-profile");
    merged.name = merged.name || merged.basicStats.identity.characterName || "新角色";
    merged.updatedAt = merged.updatedAt || new Date().toISOString();
    migrateDetailModifiers(merged);
    return merged;
  }


  function legacyModifier(value, source) {
    return value === null || value === undefined || value === "" ? null : { id: makeId("modifier"), value, type: "", source };
  }

  function setLegacyModifiers(profile, detailId, entries) {
    const modifiers = profile.basicStats.detailModifiers;
    if (Array.isArray(modifiers[detailId]) && modifiers[detailId].length) return;
    modifiers[detailId] = entries.filter(Boolean).map((item) => ({ ...item, type: item.type || "" }));
  }

  function migrateDetailModifiers(profile) {
    profile.basicStats.detailModifiers = profile.basicStats.detailModifiers && typeof profile.basicStats.detailModifiers === "object"
      ? profile.basicStats.detailModifiers
      : {};
    if (!profile.basicStats.hp.hpMaxBase && profile.basicStats.hp.max) profile.basicStats.hp.hpMaxBase = profile.basicStats.hp.max;
    if (!profile.basicStats.ac.base) profile.basicStats.ac.base = "10";

    Object.values(profile.basicStats.detailModifiers).forEach((rows) => {
      if (Array.isArray(rows)) rows.forEach((item) => { if (item.type === undefined) item.type = ""; });
    });
    setLegacyModifiers(profile, "hp", []);
    setLegacyModifiers(profile, "ac", [
      legacyModifier(profile.basicStats.ac.armor, "盔甲"),
      legacyModifier(profile.basicStats.ac.shield, "盾牌"),
      legacyModifier(profile.basicStats.ac.dex, "敏捷"),
      legacyModifier(profile.basicStats.ac.natural, "天生防御"),
      legacyModifier(profile.basicStats.ac.deflection, "偏斜"),
      legacyModifier(profile.basicStats.ac.dodge, "闪避"),
      legacyModifier(profile.basicStats.ac.size, "体型"),
      legacyModifier(profile.basicStats.ac.misc, "其他"),
    ]);
    ABILITIES.forEach(([key]) => {
      const ability = profile.basicStats.abilities[key] || {};
      setLegacyModifiers(profile, `ability-${key}`, [
        legacyModifier(ability.enhancement, "增强加值"),
        legacyModifier(ability.temporary, "临时加值"),
        legacyModifier(ability.misc, "其他加值"),
      ]);
    });
    [
      ["save-fort", "fort"],
      ["save-ref", "ref"],
      ["save-will", "will"],
    ].forEach(([detailId, prefix]) => {
      const cap = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      setLegacyModifiers(profile, detailId, [
        legacyModifier(profile.basicStats.saves[`${prefix}Ability`], "属性加值"),
        legacyModifier(profile.basicStats.saves[`${prefix}Resistance`], "抗力加值"),
        legacyModifier(profile.basicStats.saves[`${prefix}Magic`], "魔法加值"),
        legacyModifier(profile.basicStats.saves[`${prefix}Misc`], "其他加值"),
      ]);
    });
    ["attack-bab", "attack-melee", "attack-ranged", "attack-cmb", "attack-cmd", "initiative", "speed-land", "speed-fly", "speed-swim", "speed-climb", "speed-burrow"].forEach((detailId) => {
      setLegacyModifiers(profile, detailId, []);
    });
  }
  function deepMerge(base, incoming) {
    if (Array.isArray(base)) return Array.isArray(incoming) ? incoming : base;
    if (!base || typeof base !== "object") return incoming === undefined ? base : incoming;
    const output = { ...base };
    Object.entries(incoming || {}).forEach(([key, value]) => {
      output[key] = deepMerge(base[key], value);
    });
    return output;
  }

  function loadProfiles() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROFILES_KEY) || "[]");
      if (Array.isArray(parsed) && parsed.length) return parsed.map(normalizeProfile);
    } catch (_) {
      // Fall through to a clean profile.
    }
    return [defaultProfile()];
  }

  function loadActiveProfileId(profileList) {
    const stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
    return profileList.some((profile) => profile.id === stored) ? stored : profileList[0].id;
  }

  function activeProfile() {
    return profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  }

  function saveProfiles() {
    const profile = activeProfile();
    profile.updatedAt = new Date().toISOString();
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
    els.saveStatus.textContent = `已保存 ${new Date().toLocaleTimeString()}`;
    renderProfileSelect();
    renderSummary();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function getByPath(target, path) {
    return path.split(".").reduce((current, key) => (current ? current[key] : undefined), target);
  }

  function setByPath(target, path, value) {
    const keys = path.split(".");
    let current = target;
    keys.slice(0, -1).forEach((key) => {
      if (!current[key] || typeof current[key] !== "object") current[key] = {};
      current = current[key];
    });
    current[keys[keys.length - 1]] = value;
  }

  function renderField(label, path, options = {}) {
    const profile = activeProfile();
    const value = getByPath(profile, path);
    const type = options.type || "text";
    const full = options.full ? " full" : "";
    const input = type === "textarea"
      ? `<textarea data-path="${path}">${escapeHtml(value)}</textarea>`
      : `<input type="${type}" data-path="${path}" value="${escapeHtml(value)}" />`;
    return `<div class="field${full}"><label>${label}</label>${input}</div>`;
  }

  function renderEntryField(config, index, field) {
    const [name, label, type = "text", layout = ""] = field;
    const collection = getByPath(activeProfile(), config.collection) || [];
    const value = collection[index] ? collection[index][name] : "";
    const full = layout === "full" || type === "textarea" ? " full" : "";
    let input = "";
    if (type === "textarea") {
      input = `<textarea data-collection="${config.collection}" data-index="${index}" data-field="${name}">${escapeHtml(value)}</textarea>`;
    } else if (type === "checkbox") {
      input = `<input type="checkbox" data-collection="${config.collection}" data-index="${index}" data-field="${name}" ${value ? "checked" : ""} />`;
    } else {
      input = `<input type="${type}" data-collection="${config.collection}" data-index="${index}" data-field="${name}" value="${escapeHtml(value)}" />`;
    }
    return `<div class="field${full}"><label>${label}</label>${input}</div>`;
  }

  function renderNav() {
    els.sectionList.innerHTML = SECTIONS.map(([key, title]) => (
      `<button class="section-btn ${key === activeSection ? "active" : ""}" type="button" data-section="${key}">${title}</button>`
    )).join("");
  }

  function renderProfileSelect() {
    els.profileSelect.innerHTML = profiles.map((profile) => (
      `<option value="${profile.id}" ${profile.id === activeProfileId ? "selected" : ""}>${escapeHtml(profile.name || "未命名角色")}</option>`
    )).join("");
  }

  function renderSummary() {
    const profile = activeProfile();
    const hp = profile.basicStats.hp;
    const identity = profile.basicStats.identity;
    els.profileSummary.innerHTML = [
      identity.race || "未填种族",
      identity.classes || "未填职业",
      `HP ${hp.current || "-"} / ${hp.max || "-"}`,
      `更新 ${new Date(profile.updatedAt).toLocaleString()}`,
    ].map((text) => `<span class="summary-pill">${escapeHtml(text)}</span>`).join("");
  }

  const BASIC_DETAIL_ORDER = [
    "hp",
    "ac",
    "ability-str",
    "ability-dex",
    "ability-con",
    "ability-int",
    "ability-wis",
    "ability-cha",
    "save-fort",
    "save-ref",
    "save-will",
    "attack-bab",
    "attack-melee",
    "attack-ranged",
    "attack-cmb",
    "attack-cmd",
    "initiative",
    "speed-land",
    "speed-fly",
    "speed-swim",
    "speed-climb",
    "speed-burrow",
  ];

  function numberField(label, path) {
    return { label, path, type: "number" };
  }

  function baseDetailConfig(title, baseLabel, basePath, options = {}) {
    return {
      title,
      baseLabel,
      basePath,
      defaultBase: options.defaultBase || "",
      totalLabel: options.totalLabel || title,
      subtitle: options.subtitle || "最终值 = 基础值 + 下方每一条来源修正。",
      extraFields: options.extraFields || [],
      unit: options.unit || "",
    };
  }

  function abilityDetailConfig(key, label) {
    return baseDetailConfig(label, "基础值", `basicStats.abilities.${key}.base`, {
      totalLabel: "最终属性",
      subtitle: "属性最终值 = 基础值 + 每一条来源修正。",
    });
  }

  function saveDetailConfig(title, basePath) {
    return baseDetailConfig(title, "基础豁免", basePath, {
      totalLabel: "豁免总值",
      subtitle: "豁免总值 = 基础豁免 + 每一条来源修正。",
    });
  }

  function attackDetailConfig(title, basePath) {
    return baseDetailConfig(title, "基础值", basePath, {
      totalLabel: "当前总值",
      subtitle: "攻击和战技先以手填基础值为主，其他修正逐条记录来源。",
    });
  }

  function speedDetailConfig(title, basePath) {
    return baseDetailConfig(title, "基础速度", basePath, {
      totalLabel: "当前速度",
      subtitle: "速度最终值 = 基础速度 + 每一条来源修正。",
      unit: " 尺",
    });
  }

  const STATUS_DETAIL_CONFIGS = {
    hp: baseDetailConfig("HP", "最大 HP 基础值", "basicStats.hp.hpMaxBase", {
      totalLabel: "最大 HP",
      subtitle: "最大 HP = 基础值 + 每一条来源修正；当前 HP、临时 HP 和非致命伤害独立记录。",
      extraFields: [
        numberField("当前 HP (current HP)", "basicStats.hp.current"),
        numberField("临时 HP (temporary HP)", "basicStats.hp.temp"),
        numberField("非致命伤害 (nonlethal damage)", "basicStats.hp.nonlethal"),
      ],
    }),
    ac: baseDetailConfig("AC 防御", "基础 AC", "basicStats.ac.base", {
      defaultBase: "10",
      totalLabel: "总 AC",
      subtitle: "AC 总值 = 基础 AC + 每一条来源修正。来源可以写盔甲、盾牌、敏捷、偏斜、Buff 等。",
    }),
    ...Object.fromEntries(ABILITIES.map(([key, label]) => [`ability-${key}`, abilityDetailConfig(key, label)])),
    "save-fort": saveDetailConfig("强韧豁免", "basicStats.saves.fortBase"),
    "save-ref": saveDetailConfig("反射豁免", "basicStats.saves.refBase"),
    "save-will": saveDetailConfig("意志豁免", "basicStats.saves.willBase"),
    "attack-bab": attackDetailConfig("BAB", "basicStats.attacks.bab"),
    "attack-melee": attackDetailConfig("近战攻击", "basicStats.attacks.melee"),
    "attack-ranged": attackDetailConfig("远程攻击", "basicStats.attacks.ranged"),
    "attack-cmb": attackDetailConfig("CMB", "basicStats.attacks.cmb"),
    "attack-cmd": attackDetailConfig("CMD", "basicStats.attacks.cmd"),
    initiative: attackDetailConfig("先攻", "basicStats.attacks.initiative"),
    "speed-land": speedDetailConfig("陆地速度", "basicStats.speed.land"),
    "speed-fly": speedDetailConfig("飞行速度", "basicStats.speed.fly"),
    "speed-swim": speedDetailConfig("游泳速度", "basicStats.speed.swim"),
    "speed-climb": speedDetailConfig("攀爬速度", "basicStats.speed.climb"),
    "speed-burrow": speedDetailConfig("掘穴速度", "basicStats.speed.burrow"),
  };

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getDetailModifiers(profile, detailId) {
    const modifiers = profile.basicStats.detailModifiers || {};
    return Array.isArray(modifiers[detailId]) ? modifiers[detailId] : [];
  }

  function sumDetailModifiers(profile, detailId) {
    return getDetailModifiers(profile, detailId).reduce((total, item) => total + toNumber(item.value), 0);
  }

  function hasDetailValue(profile, detailId) {
    const config = STATUS_DETAIL_CONFIGS[detailId];
    if (!config) return false;
    const baseValue = getByPath(profile, config.basePath);
    return baseValue !== null && baseValue !== undefined && baseValue !== "" || getDetailModifiers(profile, detailId).some((item) => item.value !== "");
  }

  function calculateDetailTotal(profile, detailId) {
    const config = STATUS_DETAIL_CONFIGS[detailId];
    if (!config) return null;
    const rawBase = getByPath(profile, config.basePath);
    const baseValue = rawBase === "" || rawBase === null || rawBase === undefined ? config.defaultBase : rawBase;
    if ((baseValue === "" || baseValue === null || baseValue === undefined) && !hasDetailValue(profile, detailId)) return null;
    return toNumber(baseValue) + sumDetailModifiers(profile, detailId);
  }

  function calculateAbilityScore(profile, key) {
    return calculateDetailTotal(profile, `ability-${key}`);
  }

  function calculateAbilityModifier(total) {
    if (total === null || total === undefined || total === "") return null;
    return Math.floor((Number(total) - 10) / 2);
  }

  function calculateArmorClass(profile) {
    const total = calculateDetailTotal(profile, "ac");
    return { total, touch: null, flatFooted: null };
  }

  function calculateSaveTotal(profile, saveKey) {
    return calculateDetailTotal(profile, `save-${saveKey}`);
  }

  function formatPlain(value) {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
  }

  function formatSigned(value) {
    if (value === null || value === undefined || value === "") return "-";
    const number = toNumber(value);
    return number > 0 ? `+${number}` : String(number);
  }

  function formatSpeed(value) {
    if (value === null || value === undefined || value === "") return "-";
    return `${value} 尺`;
  }

  function formatDetailTotal(profile, detailId) {
    const config = STATUS_DETAIL_CONFIGS[detailId];
    const total = calculateDetailTotal(profile, detailId);
    if (config && config.unit && total !== null && total !== undefined) return `${total}${config.unit}`;
    return ["hp", "ac"].includes(detailId) || detailId.startsWith("ability-") ? formatPlain(total) : formatSigned(total);
  }

  function renderOverviewCard(id, title, value, meta = "") {
    return `
      <button class="overview-card ${activeDetailId === id ? "active" : ""}" type="button" data-action="select-detail" data-detail-id="${id}">
        <span class="overview-title">${escapeHtml(title)}</span>
        <strong class="overview-value">${escapeHtml(value)}</strong>
        ${meta ? `<span class="overview-meta">${escapeHtml(meta)}</span>` : ""}
      </button>
    `;
  }

  function renderDetailRows(rows) {
    if (!rows || !rows.length) return "";
    return `
      <div class="detail-breakdown">
        ${rows.map(([label, value]) => `
          <div class="detail-row">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderModifierRows(detailId) {
    const rows = getDetailModifiers(activeProfile(), detailId);
    const body = rows.length ? rows.map((item) => `
      <div class="modifier-row" data-modifier-id="${escapeHtml(item.id)}">
        <input class="modifier-value" type="number" data-detail-id="${detailId}" data-modifier-id="${escapeHtml(item.id)}" data-modifier-field="value" value="${escapeHtml(item.value)}" />
        <input class="modifier-type" type="text" data-detail-id="${detailId}" data-modifier-id="${escapeHtml(item.id)}" data-modifier-field="type" value="${escapeHtml(item.type)}" placeholder="数值类型" />
        <input class="modifier-source" type="text" data-detail-id="${detailId}" data-modifier-id="${escapeHtml(item.id)}" data-modifier-field="source" value="${escapeHtml(item.source)}" placeholder="来源" />
        <button class="modifier-remove-btn secondary-btn" type="button" data-action="remove-detail-modifier" data-detail-id="${detailId}" data-modifier-id="${escapeHtml(item.id)}">删除</button>      </div>
    `).join("") : `<div class="empty-state">还没有来源。点击“添加来源”记录加值或减值。</div>`;
    return `
      <div class="modifier-table">
        <div class="modifier-header">
          <span>数值</span>
          <span>数值类型</span>
          <span>来源</span>
          <span></span>
        </div>
        ${body}
      </div>
      <button type="button" data-action="add-detail-modifier" data-detail-id="${detailId}">添加来源</button>
    `;
  }

  function renderDetailSidebar() {
    if (!activeDetailId) return "";
    const config = STATUS_DETAIL_CONFIGS[activeDetailId] || STATUS_DETAIL_CONFIGS.hp;
    const total = formatDetailTotal(activeProfile(), activeDetailId);
    return `
      <div class="detail-overlay" data-action="close-detail"></div>
      <aside id="detail-sidebar" class="detail-sidebar is-open" aria-label="基础数值详情">
        <div class="detail-drawer">
          <div class="detail-heading">
            <span>数值详情</span>
            <button class="detail-close-btn" type="button" data-action="close-detail" aria-label="收起详情">×</button>
            <h3>${escapeHtml(config.title)}</h3>
            <p>${escapeHtml(config.subtitle || "")}</p>
          </div>
          ${renderDetailRows([[config.totalLabel || "最终值", total]])}
          <div class="detail-fields form-grid">
            ${renderField(config.baseLabel || "基础值", config.basePath, { type: "number" })}
            ${(config.extraFields || []).map((field) => renderField(field.label, field.path, field)).join("")}
          </div>
          <div class="modifier-section">
            <h4>来源明细</h4>
            ${renderModifierRows(activeDetailId)}
          </div>
        </div>
      </aside>
    `;
  }

  function renderBasicOverview() {
    const profile = activeProfile();
    const hp = profile.basicStats.hp;
    const hpMax = calculateDetailTotal(profile, "hp");
    const ac = calculateArmorClass(profile);
    const fort = calculateSaveTotal(profile, "fort");
    const ref = calculateSaveTotal(profile, "ref");
    const will = calculateSaveTotal(profile, "will");

    const abilityCards = ABILITIES.map(([key, label]) => {
      const total = calculateAbilityScore(profile, key);
      const modifier = calculateAbilityModifier(total);
      return renderOverviewCard(`ability-${key}`, label, formatPlain(total), `调整值 ${formatSigned(modifier)}`);
    }).join("");

    return `
      <section class="card">
        <h3>角色概览</h3>
        <div class="form-grid">
          ${renderField("角色名", "name")}
          ${renderField("玩家", "basicStats.identity.playerName")}
          ${renderField("种族", "basicStats.identity.race")}
          ${renderField("体型", "basicStats.identity.size")}
          ${renderField("职业概览", "basicStats.identity.classes")}
          ${renderField("阵营", "basicStats.identity.alignment")}
        </div>
      </section>
      <div class="basic-workspace${activeDetailId ? " has-detail" : ""}">
        <div class="basic-overview-column">
          <section class="card">
            <h3>生命与防御</h3>
            <div class="status-overview-grid compact-grid">
              ${renderOverviewCard("hp", "HP", `${formatPlain(hp.current)} / ${formatPlain(hpMax)}`, `临时 ${formatPlain(hp.temp)} · 非致命 ${formatPlain(hp.nonlethal)}`)}
              ${renderOverviewCard("ac", "AC", formatPlain(ac.total), "点开查看来源")}
            </div>
          </section>
          <section class="card">
            <h3>属性</h3>
            <div class="status-overview-grid ability-grid">
              ${abilityCards}
            </div>
          </section>
          <section class="card">
            <h3>豁免</h3>
            <div class="status-overview-grid save-grid">
              ${renderOverviewCard("save-fort", "强韧", formatSigned(fort))}
              ${renderOverviewCard("save-ref", "反射", formatSigned(ref))}
              ${renderOverviewCard("save-will", "意志", formatSigned(will))}
            </div>
          </section>
          <section class="card">
            <h3>攻击、战技与先攻</h3>
            <div class="status-overview-grid attack-grid">
              ${renderOverviewCard("attack-bab", "BAB", formatSigned(calculateDetailTotal(profile, "attack-bab")))}
              ${renderOverviewCard("attack-melee", "近战", formatSigned(calculateDetailTotal(profile, "attack-melee")))}
              ${renderOverviewCard("attack-ranged", "远程", formatSigned(calculateDetailTotal(profile, "attack-ranged")))}
              ${renderOverviewCard("attack-cmb", "CMB", formatSigned(calculateDetailTotal(profile, "attack-cmb")))}
              ${renderOverviewCard("attack-cmd", "CMD", formatSigned(calculateDetailTotal(profile, "attack-cmd")))}
              ${renderOverviewCard("initiative", "先攻", formatSigned(calculateDetailTotal(profile, "initiative")))}
            </div>
          </section>
          <section class="card">
            <h3>速度</h3>
            <div class="status-overview-grid speed-grid">
              ${renderOverviewCard("speed-land", "陆地", formatSpeed(calculateDetailTotal(profile, "speed-land")))}
              ${renderOverviewCard("speed-fly", "飞行", formatSpeed(calculateDetailTotal(profile, "speed-fly")))}
              ${renderOverviewCard("speed-swim", "游泳", formatSpeed(calculateDetailTotal(profile, "speed-swim")))}
              ${renderOverviewCard("speed-climb", "攀爬", formatSpeed(calculateDetailTotal(profile, "speed-climb")))}
              ${renderOverviewCard("speed-burrow", "掘穴", formatSpeed(calculateDetailTotal(profile, "speed-burrow")))}
            </div>
          </section>
        </div>
        ${renderDetailSidebar()}
      </div>
    `;
  }

  function renderBasic() {
    if (activeDetailId && !STATUS_DETAIL_CONFIGS[activeDetailId]) activeDetailId = null;
    return renderBasicOverview();
  }
  function renderList(config) {
    const entries = getByPath(activeProfile(), config.collection) || [];
    const body = entries.length ? entries.map((entry, index) => `
      <article class="entry-card">
        <div class="entry-title">
          <strong>${escapeHtml(entry.name || entry.featureName || entry.className || `条目 ${index + 1}`)}</strong>
          <button class="secondary-btn" type="button" data-action="remove-entry" data-collection="${config.collection}" data-index="${index}">删除</button>
        </div>
        <div class="form-grid">
          ${config.fields.map((field) => renderEntryField(config, index, field)).join("")}
        </div>
      </article>
    `).join("") : `<div class="empty-state">${config.empty}</div>`;

    return `
      <section class="card">
        <div class="list-header">
          <h3>${config.title}</h3>
          <button type="button" data-action="add-entry" data-collection="${config.collection}">${config.addText}</button>
        </div>
        ${body}
      </section>
    `;
  }

  function renderSpells() {
    return renderList(listConfigs.casters) + renderList(listConfigs.spellSlots) + renderList(listConfigs.knownSpells);
  }

  function renderNotes() {
    return `
      <section class="card">
        <h3>剧情备注</h3>
        <div class="form-grid">
          ${renderField("当前任务", "notes.currentQuest", { type: "textarea", full: true })}
          ${renderField("NPC", "notes.npcs", { type: "textarea", full: true })}
          ${renderField("地点", "notes.locations", { type: "textarea", full: true })}
          ${renderField("线索", "notes.clues", { type: "textarea", full: true })}
          ${renderField("战利品", "notes.loot", { type: "textarea", full: true })}
          ${renderField("待办", "notes.todos", { type: "textarea", full: true })}
          ${renderField("自由备注", "notes.freeform", { type: "textarea", full: true })}
        </div>
      </section>
    `;
  }

  function renderSection() {
    const section = SECTIONS.find(([key]) => key === activeSection) || SECTIONS[0];
    els.sectionTitle.textContent = section[1];
    els.sectionSubtitle.textContent = section[2];
    const renderers = {
      basic: renderBasic,
      classFeatures: () => renderList(listConfigs.classFeatures),
      spells: renderSpells,
      feats: () => renderList(listConfigs.feats),
      buffs: () => renderList(listConfigs.buffs),
      companions: () => renderList(listConfigs.companions),
      items: () => renderList(listConfigs.items),
      notes: renderNotes,
    };
    els.content.innerHTML = renderers[activeSection]();
    renderNav();
    renderSummary();
  }

  function setModifierField(detailId, modifierId, field, value) {
    const modifiers = activeProfile().basicStats.detailModifiers || {};
    const rows = Array.isArray(modifiers[detailId]) ? modifiers[detailId] : [];
    const row = rows.find((item) => item.id === modifierId);
    if (!row || !["value", "type", "source"].includes(field)) return;
    row[field] = value;
    modifiers[detailId] = rows;
    activeProfile().basicStats.detailModifiers = modifiers;
  }

  function addDetailModifier(detailId) {
    const profile = activeProfile();
    profile.basicStats.detailModifiers = profile.basicStats.detailModifiers || {};
    const rows = Array.isArray(profile.basicStats.detailModifiers[detailId]) ? profile.basicStats.detailModifiers[detailId] : [];
    rows.push({ id: makeId("modifier"), value: "", type: "", source: "" });
    profile.basicStats.detailModifiers[detailId] = rows;
    saveProfiles();
    renderSection();
  }

  function removeDetailModifier(detailId, modifierId) {
    const profile = activeProfile();
    const rows = getDetailModifiers(profile, detailId).filter((item) => item.id !== modifierId);
    profile.basicStats.detailModifiers[detailId] = rows;
    saveProfiles();
    renderSection();
  }
  function addEntry(collectionPath) {
    const config = Object.values(listConfigs).find((item) => item.collection === collectionPath);
    if (!config) return;
    const collection = getByPath(activeProfile(), collectionPath) || [];
    collection.push(config.factory());
    setByPath(activeProfile(), collectionPath, collection);
    saveProfiles();
    renderSection();
  }

  function removeEntry(collectionPath, index) {
    const collection = getByPath(activeProfile(), collectionPath) || [];
    collection.splice(Number(index), 1);
    setByPath(activeProfile(), collectionPath, collection);
    saveProfiles();
    renderSection();
  }

  function newProfile() {
    const name = window.prompt("新角色档案名称", "新角色");
    if (!name) return;
    const profile = defaultProfile(name.trim() || "新角色");
    profiles.push(profile);
    activeProfileId = profile.id;
    saveProfiles();
    renderAll();
  }

  function duplicateProfile() {
    const source = activeProfile();
    const copy = normalizeProfile(JSON.parse(JSON.stringify(source)));
    copy.id = makeId("status-profile");
    copy.name = `${source.name || "未命名角色"} 副本`;
    copy.updatedAt = new Date().toISOString();
    profiles.push(copy);
    activeProfileId = copy.id;
    saveProfiles();
    renderAll();
  }

  function deleteProfile() {
    if (profiles.length <= 1) {
      window.alert("至少需要保留一个角色档案。");
      return;
    }
    if (!window.confirm("删除当前角色状态档案？")) return;
    profiles = profiles.filter((profile) => profile.id !== activeProfileId);
    activeProfileId = profiles[0].id;
    saveProfiles();
    renderAll();
  }

  function exportProfile() {
    const profile = activeProfile();
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${profile.name || "pf-status-profile"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importProfile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const profile = normalizeProfile(JSON.parse(String(reader.result || "{}")));
        profile.id = profile.id || makeId("status-profile");
        if (profiles.some((item) => item.id === profile.id)) profile.id = makeId("status-profile");
        profiles.push(profile);
        activeProfileId = profile.id;
        saveProfiles();
        renderAll();
      } catch (_) {
        window.alert("导入失败：不是有效的 JSON 角色状态档案。");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function renderAll() {
    renderProfileSelect();
    renderNav();
    renderSection();
  }

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.dataset.modifierField) {
      setModifierField(target.dataset.detailId, target.dataset.modifierId, target.dataset.modifierField, target.value);
      saveProfiles();
      return;
    }
    if (target.dataset.path) {
      const value = target.type === "number" ? target.value : target.value;
      setByPath(activeProfile(), target.dataset.path, value);
      if (target.dataset.path === "name") {
        activeProfile().basicStats.identity.characterName = value;
      }
      saveProfiles();
    }
    if (target.dataset.collection) {
      const collection = getByPath(activeProfile(), target.dataset.collection) || [];
      const entry = collection[Number(target.dataset.index)];
      if (!entry) return;
      entry[target.dataset.field] = target.type === "checkbox" ? target.checked : target.value;
      saveProfiles();
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target === els.profileSelect) {
      activeProfileId = target.value;
      localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
      renderAll();
      return;
    }
    if (target === els.importInput && target.files && target.files[0]) {
      importProfile(target.files[0]);
      target.value = "";
      return;
    }
    if (target.dataset.modifierField && activeSection === "basic") {
      renderSection();
      return;
    }
    if (target.dataset.path && activeSection === "basic") {
      renderSection();
      return;
    }
    if (target.dataset.collection && target.type === "checkbox") {
      const collection = getByPath(activeProfile(), target.dataset.collection) || [];
      const entry = collection[Number(target.dataset.index)];
      if (!entry) return;
      entry[target.dataset.field] = target.checked;
      saveProfiles();
    }
  });

  document.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action], [data-section]");
    if (!actionTarget) return;
    if (actionTarget.dataset.section) {
      activeSection = actionTarget.dataset.section;
      activeDetailId = null;
      renderSection();
      return;
    }
    const action = actionTarget.dataset.action;
    if (action === "select-detail") {
      activeDetailId = actionTarget.dataset.detailId || activeDetailId;
      renderSection();
      return;
    }
    if (action === "close-detail") {
      activeDetailId = null;
      renderSection();
      return;
    }
    if (action === "add-detail-modifier") {
      addDetailModifier(actionTarget.dataset.detailId);
      return;
    }
    if (action === "remove-detail-modifier") {
      removeDetailModifier(actionTarget.dataset.detailId, actionTarget.dataset.modifierId);
      return;
    }
    if (action === "new-profile") newProfile();
    if (action === "duplicate-profile") duplicateProfile();
    if (action === "delete-profile") deleteProfile();
    if (action === "export-profile") exportProfile();
    if (action === "add-entry") addEntry(actionTarget.dataset.collection);
    if (action === "remove-entry") removeEntry(actionTarget.dataset.collection, actionTarget.dataset.index);
  });

  renderAll();
  saveProfiles();
})();
