(() => {
  const PROFILES_KEY = "pf_status_tracker_profiles_v1";
  const ACTIVE_PROFILE_KEY = "pf_status_tracker_active_profile_v1";

  const SECTIONS = [
    ["basic", "基础数值", "记录 HP、防御、豁免、速度、攻击加值、CMB/CMD、先攻、种族和属性。"],
    ["attacks", "攻击方式", "记录多重攻击、全回合攻击、天生武器、远程攻击和其他常用攻击方案。"],
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


  const modifierTargets = [
    ["hp", "最大 HP"],
    ["ac", "AC"],
    ["ability-str", "力量"],
    ["ability-dex", "敏捷"],
    ["ability-con", "体质"],
    ["ability-int", "智力"],
    ["ability-wis", "感知"],
    ["ability-cha", "魅力"],
    ["save-fort", "强韧"],
    ["save-ref", "反射"],
    ["save-will", "意志"],
    ["attack-bab", "BAB"],
    ["attack-melee", "近战攻击"],
    ["attack-ranged", "远程攻击"],
    ["attack-cmb", "CMB"],
    ["attack-cmd", "CMD"],
    ["initiative", "先攻"],
    ["speed-land", "陆地速度"],
    ["speed-fly", "飞行速度"],
    ["speed-swim", "游泳速度"],
    ["speed-climb", "攀爬速度"],
    ["speed-burrow", "掘穴速度"],
  ];

  const commonModifierTypes = [
    ["untyped", "未命名"],
    ["enhancement", "增强"],
    ["morale", "士气"],
    ["insight", "洞察"],
    ["luck", "幸运"],
    ["sacred", "神圣"],
    ["profane", "亵渎"],
    ["circumstance", "环境"],
    ["dodge", "闪避"],
    ["penalty", "减值"],
  ];

  const modifierTypesByTarget = {
    ac: [["armor", "护甲"], ["shield", "盾牌"], ["natural", "天生护甲"], ["deflection", "偏斜"], ["dodge", "闪避"], ["size", "体型"], ...commonModifierTypes],
    hp: [["untyped", "未命名"], ["favored", "天赋职业"], ["temporary", "临时"], ["penalty", "减值"]],
    default: commonModifierTypes,
  };

  const stackModeOptions = [
    ["default", "默认规则"],
    ["stack", "总是叠加"],
    ["highest", "同类型取最高"],
    ["display", "只展示"],
  ];

  const modifierCollections = ["classFeatures", "feats", "buffs", "companions", "items"];
  const alwaysStackTypes = new Set(["dodge", "circumstance", "untyped"]);

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
  let activeEntryModifier = null;
  let hasUnsavedChanges = false;
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
      "attackProfiles": [],
      classFeatures: [],
      spells: { casters: [], slots: [], known: [] },
      feats: [],
      buffs: [],
      companions: [],
      items: [],
      notes: { currentQuest: "", npcs: "", locations: "", clues: "", loot: "", todos: "", freeform: "" },
    };
  }


  function defaultAttackLine(name = "") {
    return {
      id: makeId("attack-line"),
      name,
      attackBonus: "",
      damage: "",
      critical: "",
      damageType: "",
      reachOrRange: "",
      notes: "",
    };
  }

  function defaultAttackProfile() {
    return {
      id: makeId("attack-profile"),
      name: "新攻击方式",
      category: "近战",
      actionType: "标准动作",
      isCommon: true,
      summary: "",
      notes: "",
      attacks: [defaultAttackLine("第一击")],
    };
  }

  function normalizeAttackProfiles(profile) {
    profile.attackProfiles = Array.isArray(profile.attackProfiles) ? profile.attackProfiles : [];
    profile.attackProfiles.forEach((attackProfile) => {
      attackProfile.id = attackProfile.id || makeId("attack-profile");
      attackProfile.attacks = Array.isArray(attackProfile.attacks) ? attackProfile.attacks : [];
      attackProfile.attacks.forEach((line) => {
        line.id = line.id || makeId("attack-line");
      });
    });
  }
  function normalizeProfile(profile) {
    const base = defaultProfile(profile && profile.name ? profile.name : "新角色");
    const merged = deepMerge(base, profile && typeof profile === "object" ? profile : {});
    merged.id = merged.id || makeId("status-profile");
    merged.name = merged.name || merged.basicStats.identity.characterName || "新角色";
    merged.updatedAt = merged.updatedAt || new Date().toISOString();
    migrateDetailModifiers(merged);
    normalizeAttackProfiles(merged);
    normalizeEntryModifiers(merged);
    return merged;
  }



  function normalizeEntryModifier(modifier) {
    return {
      id: modifier && modifier.id ? modifier.id : makeId("entry-modifier"),
      target: modifier && modifier.target ? modifier.target : "ac",
      value: modifier && modifier.value !== undefined ? modifier.value : "",
      type: modifier && modifier.type !== undefined ? modifier.type : "untyped",
      source: modifier && modifier.source !== undefined ? modifier.source : "",
      enabled: modifier && modifier.enabled !== undefined ? Boolean(modifier.enabled) : true,
      stackMode: modifier && modifier.stackMode ? modifier.stackMode : "default",
    };
  }

  function normalizeEntryModifiers(profile) {
    modifierCollections.forEach((collectionPath) => {
      const collection = getByPath(profile, collectionPath);
      if (!Array.isArray(collection)) return;
      collection.forEach((entry) => {
        entry.modifiers = Array.isArray(entry.modifiers) ? entry.modifiers.map(normalizeEntryModifier) : [];
      });
    });
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
    return [defaultProfile()];
  }

  function loadActiveProfileId(profileList) {
    return profileList[0].id;
  }

  function activeProfile() {
    return profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  }

  function setSaveStatus(message) {
    els.saveStatus.textContent = message;
  }

  function markProfilesDirty() {
    hasUnsavedChanges = true;
    setSaveStatus("有未保存改动，请保存到浏览器或导出 JSON。");
  }

  function saveProfiles() {
    const profile = activeProfile();
    profile.updatedAt = new Date().toISOString();
    markProfilesDirty();
    renderProfileSelect();
    renderSummary();
  }

  function saveProfilesToBrowser() {
    const profile = activeProfile();
    profile.updatedAt = new Date().toISOString();
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
    hasUnsavedChanges = false;
    setSaveStatus(`已保存到浏览器 ${new Date().toLocaleTimeString()}`);
    renderProfileSelect();
    renderSummary();
  }

  function loadProfilesFromBrowser() {
    const stored = localStorage.getItem(PROFILES_KEY);
    if (!stored) {
      window.alert("浏览器中没有已保存的状态卡。");
      return;
    }
    if (hasUnsavedChanges && !window.confirm("读取浏览器存档会覆盖当前临时状态，是否继续？")) return;
    try {
      const parsed = JSON.parse(stored || "[]");
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("empty browser save");
      profiles = parsed.map(normalizeProfile);
      const storedActiveId = localStorage.getItem(ACTIVE_PROFILE_KEY);
      activeProfileId = profiles.some((profile) => profile.id === storedActiveId) ? storedActiveId : profiles[0].id;
      activeDetailId = null;
      activeEntryModifier = null;
      hasUnsavedChanges = false;
      renderAll();
      setSaveStatus(`已读取浏览器存档 ${new Date().toLocaleTimeString()}`);
    } catch (_) {
      window.alert("读取失败：浏览器存档不是有效的状态卡 JSON。");
    }
  }

  function clearBrowserSave() {
    if (!window.confirm("清除浏览器中的状态卡存档？当前页面中的临时状态不会被清空。")) return;
    localStorage.removeItem(PROFILES_KEY);
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    setSaveStatus("已清除浏览器存档；当前状态仍是临时数据。");
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


  function getModifierTargetLabel(target) {
    const item = modifierTargets.find(([id]) => id === target);
    return item ? item[1] : target;
  }

  function getEntryTitle(entry, fallback = "条目") {
    return entry.name || entry.featureName || entry.className || entry.type || fallback;
  }

  function getModifierTypeOptions(target) {
    return modifierTypesByTarget[target] || modifierTypesByTarget.default;
  }

  function renderOptions(options, selected) {
    return options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${String(selected) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
  }

  function isEntryModifierActive(collectionPath, entry, modifier) {
    if (!modifier || modifier.enabled === false) return false;
    if (entry && entry.enabled === false) return false;
    if (collectionPath === "items" && entry && entry.equipped === false && entry.enabled === false) return false;
    return true;
  }

  function collectAutomaticModifiers(profile, detailId = null) {
    const rows = [];
    modifierCollections.forEach((collectionPath) => {
      const collection = getByPath(profile, collectionPath);
      if (!Array.isArray(collection)) return;
      const config = Object.values(listConfigs).find((item) => item.collection === collectionPath);
      collection.forEach((entry, entryIndex) => {
        const modifiers = Array.isArray(entry.modifiers) ? entry.modifiers : [];
        modifiers.forEach((modifier) => {
          if (detailId && modifier.target !== detailId) return;
          if (!isEntryModifierActive(collectionPath, entry, modifier)) return;
          rows.push({
            ...modifier,
            collection: collectionPath,
            collectionTitle: config ? config.title : collectionPath,
            entryIndex,
            entryName: getEntryTitle(entry, `条目 ${entryIndex + 1}`),
            source: modifier.source || getEntryTitle(entry, `条目 ${entryIndex + 1}`),
          });
        });
      });
    });
    return rows;
  }

  function getAutomaticModifiersForDetail(profile, detailId) {
    return collectAutomaticModifiers(profile, detailId);
  }

  function calculateStackedModifierTotal(modifiers) {
    let total = 0;
    const highestByType = new Map();
    (modifiers || []).forEach((modifier) => {
      const value = toNumber(modifier.value);
      if (!value || modifier.stackMode === "display") return;
      const type = modifier.type || "untyped";
      if (value < 0 || modifier.stackMode === "stack" || alwaysStackTypes.has(type)) {
        total += value;
        return;
      }
      const key = `${modifier.target || ""}:${type}`;
      const current = highestByType.has(key) ? highestByType.get(key) : 0;
      highestByType.set(key, Math.max(current, value));
    });
    highestByType.forEach((value) => { total += value; });
    return total;
  }
  function getDetailModifiers(profile, detailId) {
    const modifiers = profile.basicStats.detailModifiers || {};
    return Array.isArray(modifiers[detailId]) ? modifiers[detailId] : [];
  }

  function sumDetailModifiers(profile, detailId) {
    return getDetailModifiers(profile, detailId).reduce((total, item) => total + toNumber(item.value), 0);
  }

  function sumAutomaticModifiers(profile, detailId) {
    return calculateStackedModifierTotal(getAutomaticModifiersForDetail(profile, detailId));
  }

  function hasDetailValue(profile, detailId) {
    const config = STATUS_DETAIL_CONFIGS[detailId];
    if (!config) return false;
    const baseValue = getByPath(profile, config.basePath);
    return baseValue !== null && baseValue !== undefined && baseValue !== "" || getDetailModifiers(profile, detailId).some((item) => item.value !== "") || getAutomaticModifiersForDetail(profile, detailId).some((item) => item.value !== "");
  }

  function calculateDetailTotal(profile, detailId) {
    const config = STATUS_DETAIL_CONFIGS[detailId];
    if (!config) return null;
    const rawBase = getByPath(profile, config.basePath);
    const baseValue = rawBase === "" || rawBase === null || rawBase === undefined ? config.defaultBase : rawBase;
    if ((baseValue === "" || baseValue === null || baseValue === undefined) && !hasDetailValue(profile, detailId)) return null;
    return toNumber(baseValue) + sumDetailModifiers(profile, detailId) + sumAutomaticModifiers(profile, detailId);
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


  function renderAutomaticModifierRows(detailId) {
    const rows = getAutomaticModifiersForDetail(activeProfile(), detailId);
    if (!rows.length) return `<div class="empty-state">暂无自动来源。可以在专长、Buff、职业能力、其他生物或奇物中添加数值影响。</div>`;
    return `
      <div class="automatic-modifier-table">
        <div class="automatic-modifier-header">
          <span>数值</span>
          <span>类型</span>
          <span>来源</span>
          <span>叠加</span>
        </div>
        ${rows.map((item) => `
          <div class="automatic-modifier-row" data-modifier-target="${escapeHtml(item.target)}">
            <strong>${escapeHtml(formatSigned(item.value))}</strong>
            <span>${escapeHtml(item.type || "untyped")}</span>
            <span>${escapeHtml(item.collectionTitle)} / ${escapeHtml(item.source)}</span>
            <span>${escapeHtml(item.stackMode || "default")}</span>
          </div>
        `).join("")}
      </div>
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
            <h4>手动来源</h4>
            ${renderModifierRows(activeDetailId)}
          </div>
          <div class="modifier-section">
            <h4>自动来源</h4>
            ${renderAutomaticModifierRows(activeDetailId)}
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

  function renderEntryModifierEditorRows(collection, index, entry) {
    entry.modifiers = Array.isArray(entry.modifiers) ? entry.modifiers : [];
    const rows = entry.modifiers.length ? entry.modifiers.map((modifier) => {
      const target = modifier.target || "ac";
      return `
        <div class="entry-modifier-row" data-entry-modifier-id="${escapeHtml(modifier.id)}">
          <input type="number" value="${escapeHtml(modifier.value)}" data-collection="${escapeHtml(collection)}" data-index="${index}" data-entry-modifier-id="${escapeHtml(modifier.id)}" data-entry-modifier-field="value" placeholder="数值" />
          <select data-collection="${escapeHtml(collection)}" data-index="${index}" data-entry-modifier-id="${escapeHtml(modifier.id)}" data-entry-modifier-field="target">${renderOptions(modifierTargets, target)}</select>
          <select data-collection="${escapeHtml(collection)}" data-index="${index}" data-entry-modifier-id="${escapeHtml(modifier.id)}" data-entry-modifier-field="type">${renderOptions(getModifierTypeOptions(target), modifier.type || "untyped")}</select>
          <input type="text" value="${escapeHtml(modifier.source)}" data-collection="${escapeHtml(collection)}" data-index="${index}" data-entry-modifier-id="${escapeHtml(modifier.id)}" data-entry-modifier-field="source" placeholder="来源" />
          <select data-collection="${escapeHtml(collection)}" data-index="${index}" data-entry-modifier-id="${escapeHtml(modifier.id)}" data-entry-modifier-field="stackMode">${renderOptions(stackModeOptions, modifier.stackMode || "default")}</select>
          <label class="inline-check"><input type="checkbox" ${modifier.enabled === false ? "" : "checked"} data-collection="${escapeHtml(collection)}" data-index="${index}" data-entry-modifier-id="${escapeHtml(modifier.id)}" data-entry-modifier-field="enabled" />启用</label>
          <button class="secondary-btn" type="button" data-action="remove-entry-modifier" data-collection="${escapeHtml(collection)}" data-index="${index}" data-entry-modifier-id="${escapeHtml(modifier.id)}">删除</button>
        </div>
      `;
    }).join("") : `<div class="empty-state">暂无数值影响。添加后会自动计入基础数值。</div>`;
    return `
      <div class="entry-modifier-table">
        <div class="entry-modifier-header">
          <span>数值</span><span>目标</span><span>类型</span><span>来源</span><span>叠加</span><span>启用</span><span></span>
        </div>
        ${rows}
      </div>
      <button type="button" data-action="add-entry-modifier" data-collection="${escapeHtml(collection)}" data-index="${index}">添加数值影响</button>
    `;
  }

  function renderEntryModifierSummary(entry) {
    const modifiers = Array.isArray(entry.modifiers) ? entry.modifiers : [];
    if (!modifiers.length) return `<span class="summary-chip muted-chip">无数值影响</span>`;
    return modifiers.slice(0, 4).map((modifier) => `
      <span class="summary-chip ${modifier.enabled === false ? "muted-chip" : ""}">
        ${escapeHtml(getModifierTargetLabel(modifier.target || "ac"))} ${escapeHtml(formatSigned(modifier.value))} ${escapeHtml(modifier.type || "untyped")}
      </span>
    `).join("") + (modifiers.length > 4 ? `<span class="summary-chip muted-chip">+${modifiers.length - 4}</span>` : "");
  }

  function getEntryMetaParts(config, entry) {
    const parts = [];
    [entry.source, entry.type, entry.className, entry.slot, entry.duration, entry.remaining].forEach((value) => {
      if (value) parts.push(value);
    });
    if (entry.enabled !== undefined) parts.push(entry.enabled ? "启用" : "未启用");
    if (entry.alwaysOn !== undefined) parts.push(entry.alwaysOn ? "常驻" : "非常驻");
    if (entry.equipped !== undefined) parts.push(entry.equipped ? "已装备" : "未装备");
    return parts.length ? parts : [config.title];
  }

  function getEntryEffectSummary(entry) {
    return entry.effect || entry.abilities || entry.currentState || entry.affectedStats || entry.notes || "未填写效果。";
  }

  function renderEntrySummary(config, entry, index) {
    return `
      <article class="entry-card entry-summary-card">
        <div class="entry-title">
          <div>
            <strong>${escapeHtml(getEntryTitle(entry, `条目 ${index + 1}`))}</strong>
            <div class="entry-summary-meta">${getEntryMetaParts(config, entry).map((part) => `<span>${escapeHtml(part)}</span>`).join("")}</div>
          </div>
          <div class="entry-actions entry-modifier-actions">
            <button type="button" data-action="open-entry-editor" data-collection="${config.collection}" data-index="${index}">编辑</button>
            <button class="secondary-btn" type="button" data-action="remove-entry" data-collection="${config.collection}" data-index="${index}">删除</button>
          </div>
        </div>
        <p class="entry-summary-effect">${escapeHtml(getEntryEffectSummary(entry))}</p>
        <div class="entry-summary-modifiers">${renderEntryModifierSummary(entry)}</div>
      </article>
    `;
  }

  function renderEntryEditorDrawer(config) {
    if (!activeEntryModifier) return "";
    const { collection, index } = activeEntryModifier;
    const entry = (getByPath(activeProfile(), collection) || [])[Number(index)];
    if (!entry) return "";
    const drawerConfig = config || Object.values(listConfigs).find((item) => item.collection === collection);
    if (!drawerConfig) return "";
    return `
      <div class="detail-overlay" data-action="close-entry-editor"></div>
      <aside class="detail-sidebar entry-modifier-drawer entry-editor-drawer is-open" aria-label="条目编辑">
        <div class="detail-drawer">
          <div class="detail-heading">
            <span>条目编辑</span>
            <button class="detail-close-btn" type="button" data-action="close-entry-editor" aria-label="收起详情">×</button>
            <h3>${escapeHtml(getEntryTitle(entry))}</h3>
            <p>主界面只显示摘要；这里编辑完整字段和该条目对基础数值产生的影响。</p>
          </div>
          <section class="entry-editor-section">
            <h4>普通字段</h4>
            <div class="form-grid">
              ${drawerConfig.fields.map((field) => renderEntryField(drawerConfig, Number(index), field)).join("")}
            </div>
          </section>
          <section class="entry-editor-section">
            <h4>数值影响</h4>
            ${renderEntryModifierEditorRows(collection, Number(index), entry)}
          </section>
        </div>
      </aside>
    `;
  }

  function renderEntryModifierDrawer() {
    return renderEntryEditorDrawer();
  }

  function renderList(config) {
    const entries = getByPath(activeProfile(), config.collection) || [];
    const useSummaryCards = modifierCollections.includes(config.collection);
    const body = entries.length ? entries.map((entry, index) => useSummaryCards ? renderEntrySummary(config, entry, index) : `
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
        ${useSummaryCards && activeEntryModifier && activeEntryModifier.collection === config.collection ? renderEntryEditorDrawer(config) : ""}
      </section>
    `;
  }

  function renderAttackLine(profileIndex, line, lineIndex) {
    const base = `attackProfiles.${profileIndex}.attacks.${lineIndex}`;
    return `
      <div class="attack-line-row">
        ${renderField("名称", `${base}.name`)}
        ${renderField("命中加值", `${base}.attackBonus`)}
        ${renderField("伤害", `${base}.damage`)}
        ${renderField("重击", `${base}.critical`)}
        ${renderField("伤害类型", `${base}.damageType`)}
        ${renderField("触及/射程", `${base}.reachOrRange`)}
        <button class="secondary-btn" type="button" data-action="remove-attack-line" data-profile-index="${profileIndex}" data-line-index="${lineIndex}">删除</button>
      </div>
    `;
  }

  function renderAttackProfiles() {
    const profiles = activeProfile().attackProfiles || [];
    const body = profiles.length ? profiles.map((profile, index) => `
      <article class="attack-profile-card">
        <div class="entry-title">
          <strong>${escapeHtml(profile.name || `攻击方式 ${index + 1}`)}</strong>
          <div class="entry-actions">
            <button type="button" data-action="duplicate-attack-profile" data-profile-index="${index}">复制</button>
            <button class="secondary-btn" type="button" data-action="remove-attack-profile" data-profile-index="${index}">删除</button>
          </div>
        </div>
        <div class="form-grid">
          ${renderField("名称", `attackProfiles.${index}.name`)}
          ${renderField("类型", `attackProfiles.${index}.category`)}
          ${renderField("动作", `attackProfiles.${index}.actionType`)}
          ${renderField("常用", `attackProfiles.${index}.isCommon`, { type: "checkbox" })}
          ${renderField("摘要", `attackProfiles.${index}.summary`, { full: true })}
          ${renderField("备注", `attackProfiles.${index}.notes`, { type: "textarea", full: true })}
        </div>
        <div class="attack-lines-table">
          <div class="attack-lines-header">
            <span>名称</span>
            <span>命中</span>
            <span>伤害</span>
            <span>重击</span>
            <span>类型</span>
            <span>触及/射程</span>
            <span></span>
          </div>
          ${(profile.attacks || []).map((line, lineIndex) => renderAttackLine(index, line, lineIndex)).join("")}
        </div>
        <button type="button" data-action="add-attack-line" data-profile-index="${index}">添加攻击段</button>
      </article>
    `).join("") : `<div class="empty-state">还没有攻击方式。可以添加长剑全回合、弓箭齐射、爪爪咬、双武器等方案。</div>`;

    return `
      <section class="card">
        <div class="list-header">
          <h3>攻击方式</h3>
          <button type="button" data-action="add-attack-profile">添加攻击方式</button>
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
      attacks: renderAttackProfiles,
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


  function getEntryModifier(collectionPath, index, modifierId) {
    const collection = getByPath(activeProfile(), collectionPath) || [];
    const entry = collection[Number(index)];
    if (!entry) return null;
    entry.modifiers = Array.isArray(entry.modifiers) ? entry.modifiers : [];
    return entry.modifiers.find((item) => item.id === modifierId) || null;
  }

  function setEntryModifierField(collectionPath, index, modifierId, field, rawValue) {
    const modifier = getEntryModifier(collectionPath, index, modifierId);
    if (!modifier || !["value", "target", "type", "source", "enabled", "stackMode"].includes(field)) return;
    modifier[field] = field === "enabled" ? Boolean(rawValue) : rawValue;
  }

  function addEntryModifier(collectionPath, index) {
    const collection = getByPath(activeProfile(), collectionPath) || [];
    const entry = collection[Number(index)];
    if (!entry) return;
    entry.modifiers = Array.isArray(entry.modifiers) ? entry.modifiers : [];
    entry.modifiers.push({
      id: makeId("entry-modifier"),
      target: "ac",
      value: "",
      type: "untyped",
      source: getEntryTitle(entry),
      enabled: true,
      stackMode: "default",
    });
    saveProfiles();
    renderSection();
  }

  function removeEntryModifier(collectionPath, index, modifierId) {
    const collection = getByPath(activeProfile(), collectionPath) || [];
    const entry = collection[Number(index)];
    if (!entry) return;
    entry.modifiers = (Array.isArray(entry.modifiers) ? entry.modifiers : []).filter((item) => item.id !== modifierId);
    saveProfiles();
    renderSection();
  }
  function addAttackProfile() {
    activeProfile().attackProfiles.push(defaultAttackProfile());
    saveProfiles();
    renderSection();
  }

  function duplicateAttackProfile(index) {
    const source = activeProfile().attackProfiles[Number(index)];
    if (!source) return;
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = makeId("attack-profile");
    copy.name = `${copy.name || "攻击方式"} 副本`;
    copy.attacks = (copy.attacks || []).map((line) => ({ ...line, id: makeId("attack-line") }));
    activeProfile().attackProfiles.splice(Number(index) + 1, 0, copy);
    saveProfiles();
    renderSection();
  }

  function removeAttackProfile(index) {
    activeProfile().attackProfiles.splice(Number(index), 1);
    saveProfiles();
    renderSection();
  }

  function addAttackLine(profileIndex) {
    const profile = activeProfile().attackProfiles[Number(profileIndex)];
    if (!profile) return;
    profile.attacks = Array.isArray(profile.attacks) ? profile.attacks : [];
    profile.attacks.push(defaultAttackLine(`第 ${profile.attacks.length + 1} 击`));
    saveProfiles();
    renderSection();
  }

  function removeAttackLine(profileIndex, lineIndex) {
    const profile = activeProfile().attackProfiles[Number(profileIndex)];
    if (!profile || !Array.isArray(profile.attacks)) return;
    profile.attacks.splice(Number(lineIndex), 1);
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


  function resetSection(profile, sectionKey) {
    const fresh = defaultProfile(profile.name || profile.basicStats.identity.characterName || "新角色");
    if (sectionKey === "basic") {
      const keptName = profile.name;
      const keptCharacterName = profile.basicStats.identity.characterName || keptName;
      profile.basicStats = fresh.basicStats;
      profile.name = keptName;
      profile.basicStats.identity.characterName = keptCharacterName;
      return;
    }
    if (sectionKey === "attacks") profile.attackProfiles = [];
    if (sectionKey === "classFeatures") profile.classFeatures = [];
    if (sectionKey === "spells") profile.spells = fresh.spells;
    if (sectionKey === "feats") profile.feats = [];
    if (sectionKey === "buffs") profile.buffs = [];
    if (sectionKey === "companions") profile.companions = [];
    if (sectionKey === "items") profile.items = [];
    if (sectionKey === "notes") profile.notes = fresh.notes;
  }

  function clearCurrentSection() {
    const section = SECTIONS.find(([key]) => key === activeSection) || SECTIONS[0];
    if (!window.confirm(`确定清空当前页面“${section[1]}”的所有内容吗？此操作不可撤销。`)) return;
    resetSection(activeProfile(), section[0]);
    activeDetailId = null;
    activeEntryModifier = null;
    saveProfiles();
    renderAll();
  }

  function clearCurrentProfile() {
    const profile = activeProfile();
    if (!window.confirm("确定清空当前角色档案的所有状态内容吗？此操作不可撤销。")) return;
    const keptName = profile.name;
    const keptCharacterName = profile.basicStats.identity.characterName || keptName;
    const fresh = defaultProfile(keptName || keptCharacterName || "新角色");
    fresh.id = profile.id;
    fresh.name = keptName;
    fresh.basicStats.identity.characterName = keptCharacterName;
    const index = profiles.findIndex((item) => item.id === profile.id);
    if (index >= 0) profiles[index] = fresh;
    activeDetailId = null;
    activeEntryModifier = null;
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
    if (target.dataset.entryModifierField) {
      const value = target.type === "checkbox" ? target.checked : target.value;
      setEntryModifierField(target.dataset.collection, target.dataset.index, target.dataset.entryModifierId, target.dataset.entryModifierField, value);
      saveProfiles();
      return;
    }
    if (target.dataset.modifierField) {
      setModifierField(target.dataset.detailId, target.dataset.modifierId, target.dataset.modifierField, target.value);
      saveProfiles();
      return;
    }
    if (target.dataset.path) {
      const value = target.type === "checkbox" ? target.checked : target.value;
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
      markProfilesDirty();
      renderAll();
      return;
    }
    if (target === els.importInput && target.files && target.files[0]) {
      importProfile(target.files[0]);
      target.value = "";
      return;
    }
    if (target.dataset.entryModifierField) {
      const value = target.type === "checkbox" ? target.checked : target.value;
      setEntryModifierField(target.dataset.collection, target.dataset.index, target.dataset.entryModifierId, target.dataset.entryModifierField, value);
      saveProfiles();
      renderSection();
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
      activeEntryModifier = null;
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
      activeEntryModifier = null;
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
    if (action === "open-entry-editor" || action === "open-entry-modifiers") {
      activeEntryModifier = { collection: actionTarget.dataset.collection, index: actionTarget.dataset.index };
      renderSection();
      return;
    }
    if (action === "close-entry-editor" || action === "close-entry-modifiers") {
      activeEntryModifier = null;
      renderSection();
      return;
    }
    if (action === "add-entry-modifier") {
      addEntryModifier(actionTarget.dataset.collection, actionTarget.dataset.index);
      return;
    }
    if (action === "remove-entry-modifier") {
      removeEntryModifier(actionTarget.dataset.collection, actionTarget.dataset.index, actionTarget.dataset.entryModifierId);
      return;
    }
    if (action === "add-attack-profile") { addAttackProfile(); return; }
    if (action === "duplicate-attack-profile") { duplicateAttackProfile(actionTarget.dataset.profileIndex); return; }
    if (action === "remove-attack-profile") { removeAttackProfile(actionTarget.dataset.profileIndex); return; }
    if (action === "add-attack-line") { addAttackLine(actionTarget.dataset.profileIndex); return; }
    if (action === "remove-attack-line") { removeAttackLine(actionTarget.dataset.profileIndex, actionTarget.dataset.lineIndex); return; }
    if (action === "clear-current-section") { clearCurrentSection(); return; }
    if (action === "clear-current-profile") { clearCurrentProfile(); return; }
    if (action === "new-profile") { newProfile(); return; }
    if (action === "duplicate-profile") { duplicateProfile(); return; }
    if (action === "delete-profile") { deleteProfile(); return; }
    if (action === "save-to-browser") { saveProfilesToBrowser(); return; }
    if (action === "load-from-browser") { loadProfilesFromBrowser(); return; }
    if (action === "clear-browser-save") { clearBrowserSave(); return; }
    if (action === "export-profile") { exportProfile(); return; }
    if (action === "add-entry") addEntry(actionTarget.dataset.collection);
    if (action === "remove-entry") removeEntry(actionTarget.dataset.collection, actionTarget.dataset.index);
  });

  renderAll();
  setSaveStatus("临时状态，关闭或刷新会丢失；请保存到浏览器或导出 JSON。");
})();
