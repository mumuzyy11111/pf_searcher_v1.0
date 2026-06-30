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
        hp: { max: "", current: "", temp: "", nonlethal: "", notes: "" },
        abilities: Object.fromEntries(ABILITIES.map(([key]) => [key, { base: "", enhancement: "", temporary: "", misc: "", notes: "" }])),
        ac: { armor: "", shield: "", dex: "", natural: "", deflection: "", dodge: "", size: "", misc: "", notes: "" },
        saves: {
          fortBase: "", fortAbility: "", fortResistance: "", fortMagic: "", fortMisc: "",
          refBase: "", refAbility: "", refResistance: "", refMagic: "", refMisc: "",
          willBase: "", willAbility: "", willResistance: "", willMagic: "", willMisc: "",
        },
        attacks: { bab: "", melee: "", ranged: "", cmb: "", cmd: "", initiative: "", misc: "", notes: "" },
        speed: { land: "30", fly: "", swim: "", climb: "", burrow: "", notes: "" },
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
    return merged;
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

  function renderBasic() {
    const abilityCards = ABILITIES.map(([key, label]) => `
      <div class="entry-card">
        <div class="entry-title"><strong>${label}</strong></div>
        <div class="form-grid">
          ${renderField("基础值", `basicStats.abilities.${key}.base`, { type: "number" })}
          ${renderField("增强", `basicStats.abilities.${key}.enhancement`, { type: "number" })}
          ${renderField("临时", `basicStats.abilities.${key}.temporary`, { type: "number" })}
          ${renderField("其他", `basicStats.abilities.${key}.misc`, { type: "number" })}
          ${renderField("备注", `basicStats.abilities.${key}.notes`, { type: "textarea", full: true })}
        </div>
      </div>
    `).join("");

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
      <section class="card">
        <h3>HP</h3>
        <div class="form-grid">
          ${renderField("最大 HP", "basicStats.hp.max", { type: "number" })}
          ${renderField("当前 HP", "basicStats.hp.current", { type: "number" })}
          ${renderField("临时 HP", "basicStats.hp.temp", { type: "number" })}
          ${renderField("非致命伤害", "basicStats.hp.nonlethal", { type: "number" })}
          ${renderField("HP 备注", "basicStats.hp.notes", { type: "textarea", full: true })}
        </div>
      </section>
      <section class="card">
        <h3>属性</h3>
        ${abilityCards}
      </section>
      <section class="card">
        <h3>AC 防御</h3>
        <div class="form-grid">
          ${renderField("盔甲", "basicStats.ac.armor", { type: "number" })}
          ${renderField("盾牌", "basicStats.ac.shield", { type: "number" })}
          ${renderField("敏捷", "basicStats.ac.dex", { type: "number" })}
          ${renderField("天生防御", "basicStats.ac.natural", { type: "number" })}
          ${renderField("偏斜", "basicStats.ac.deflection", { type: "number" })}
          ${renderField("闪避", "basicStats.ac.dodge", { type: "number" })}
          ${renderField("体型", "basicStats.ac.size", { type: "number" })}
          ${renderField("其他", "basicStats.ac.misc", { type: "number" })}
          ${renderField("AC 备注", "basicStats.ac.notes", { type: "textarea", full: true })}
        </div>
      </section>
      <section class="card">
        <h3>豁免</h3>
        <div class="form-grid">
          ${renderField("强韧基础", "basicStats.saves.fortBase", { type: "number" })}
          ${renderField("强韧属性", "basicStats.saves.fortAbility", { type: "number" })}
          ${renderField("强韧抗力", "basicStats.saves.fortResistance", { type: "number" })}
          ${renderField("强韧其他", "basicStats.saves.fortMisc", { type: "number" })}
          ${renderField("反射基础", "basicStats.saves.refBase", { type: "number" })}
          ${renderField("反射属性", "basicStats.saves.refAbility", { type: "number" })}
          ${renderField("反射抗力", "basicStats.saves.refResistance", { type: "number" })}
          ${renderField("反射其他", "basicStats.saves.refMisc", { type: "number" })}
          ${renderField("意志基础", "basicStats.saves.willBase", { type: "number" })}
          ${renderField("意志属性", "basicStats.saves.willAbility", { type: "number" })}
          ${renderField("意志抗力", "basicStats.saves.willResistance", { type: "number" })}
          ${renderField("意志其他", "basicStats.saves.willMisc", { type: "number" })}
        </div>
      </section>
      <section class="card">
        <h3>攻击、CMB/CMD、先攻与速度</h3>
        <div class="form-grid">
          ${renderField("BAB", "basicStats.attacks.bab", { type: "number" })}
          ${renderField("近战攻击加值", "basicStats.attacks.melee", { type: "number" })}
          ${renderField("远程攻击加值", "basicStats.attacks.ranged", { type: "number" })}
          ${renderField("CMB", "basicStats.attacks.cmb", { type: "number" })}
          ${renderField("CMD", "basicStats.attacks.cmd", { type: "number" })}
          ${renderField("先攻", "basicStats.attacks.initiative", { type: "number" })}
          ${renderField("攻击其他", "basicStats.attacks.misc", { type: "number" })}
          ${renderField("陆地速度", "basicStats.speed.land", { type: "number" })}
          ${renderField("飞行速度", "basicStats.speed.fly", { type: "number" })}
          ${renderField("游泳速度", "basicStats.speed.swim", { type: "number" })}
          ${renderField("攀爬速度", "basicStats.speed.climb", { type: "number" })}
          ${renderField("掘穴速度", "basicStats.speed.burrow", { type: "number" })}
          ${renderField("攻击与速度备注", "basicStats.attacks.notes", { type: "textarea", full: true })}
          ${renderField("速度备注", "basicStats.speed.notes", { type: "textarea", full: true })}
        </div>
      </section>
    `;
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
    if (target.dataset.collection && target.type === "checkbox") {
      const collection = getByPath(activeProfile(), target.dataset.collection) || [];
      const entry = collection[Number(target.dataset.index)];
      if (!entry) return;
      entry[target.dataset.field] = target.checked;
      saveProfiles();
    }
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.section) {
      activeSection = button.dataset.section;
      renderSection();
      return;
    }
    const action = button.dataset.action;
    if (action === "new-profile") newProfile();
    if (action === "duplicate-profile") duplicateProfile();
    if (action === "delete-profile") deleteProfile();
    if (action === "export-profile") exportProfile();
    if (action === "add-entry") addEntry(button.dataset.collection);
    if (action === "remove-entry") removeEntry(button.dataset.collection, button.dataset.index);
  });

  renderAll();
  saveProfiles();
})();
