(() => {
  const STORAGE_KEY = "pf_character_workbench_v1";
  const APP_VERSION = "1.2.2";
  const SCHEMA_VERSION = "0.1.0";
  const ABILITIES = [
    ["str", "力量"],
    ["dex", "敏捷"],
    ["con", "体质"],
    ["int", "智力"],
    ["wis", "感知"],
    ["cha", "魅力"],
  ];
  const SIZE_MODIFIERS = {
    "超微型": { ac: 8, combat: -8 },
    "微型": { ac: 4, combat: -4 },
    "超小型": { ac: 2, combat: -2 },
    "小型": { ac: 1, combat: -1 },
    "中型": { ac: 0, combat: 0 },
    "大型": { ac: -1, combat: 1 },
    "超大型": { ac: -2, combat: 2 },
    "巨型": { ac: -4, combat: 4 },
    "超巨型": { ac: -8, combat: 8 },
    fine: { ac: 8, combat: -8 },
    diminutive: { ac: 4, combat: -4 },
    tiny: { ac: 2, combat: -2 },
    small: { ac: 1, combat: -1 },
    medium: { ac: 0, combat: 0 },
    large: { ac: -1, combat: 1 },
    huge: { ac: -2, combat: 2 },
    gargantuan: { ac: -4, combat: 4 },
    colossal: { ac: -8, combat: 8 },
  };
  const STEPS = [
    ["identity", "基础信息", "填写角色核心资料。"],
    ["abilities", "属性", "录入六项属性并查看调整值。"],
    ["classes", "职业", "管理职业等级。"],
    ["skills", "技能", "记录技能点和技能说明。"],
    ["feats", "专长", "从资料库添加专长。"],
    ["spells", "法术", "从资料库添加法术。"],
    ["items", "装备", "从奇物资料添加装备。"],
    ["combat", "战斗数据", "查看基础派生数据。"],
    ["validation", "自动校验", "查看当前角色卡的明显问题。"],
    ["export", "导出", "导出或复制角色档案。"],
  ];
  const SPELL_FALLBACK_SOURCES = [
    "/result/crb/spells-crb.json",
    "/result/acg/spells-acg.json",
    "/result/apg/spells-apg.json",
    "/result/arg/spells-arg.json",
    "/result/uc/spells-uc-model.json",
    "/result/um/spells-um-model.json",
    "/result/ui/spells-ui-model.json",
    "/result/oa/spells-oa.json",
    "/result/aarch/spells-aarch-model.json",
    "/result/cotr/spells-cotr-model.json",
    "/result/fob/spells-fob-model.json",
    "/result/foc/spells-foc-model.json",
    "/result/fop/spells-fop-model.json",
    "/result/isg/spells-isg-model.json",
    "/result/isi/spells-isi-model.json",
    "/result/ism/spells-ism-model.json",
    "/result/iswg/spells-iswg-model.json",
    "/result/mtt/spells-mtt-model.json",
    "/result/rtt/spells-rtt-model.json",
    "/result/tg/spells-tg-model.json",
    "/result/ag/spells-ag-model.json",
    "/result/mc/spells-mc-model.json",
    "/result/ma/spells-ma-model.json",
    "/result/vc/spells-vc-model.json",
    "/result/ha/spells-ha-model.json",
    "/result/uw/spells-uw-model.json",
    "/result/pa/spells-pa-model.json",
    "/result/botd/spells-botd-model.json",
  ];

  const els = {
    saveStatus: document.getElementById("save-status"),
    newBtn: document.getElementById("new-character-btn"),
    exportBtn: document.getElementById("export-json-btn"),
    importInput: document.getElementById("import-json-input"),
    stepList: document.getElementById("step-list"),
    stepTitle: document.getElementById("step-title"),
    stepSubtitle: document.getElementById("step-subtitle"),
    quickSummary: document.getElementById("quick-summary"),
    content: document.getElementById("step-content"),
    libraryStatus: document.getElementById("library-status"),
    libraryTabs: document.getElementById("library-tabs"),
    librarySearch: document.getElementById("library-search"),
    libraryResults: document.getElementById("library-results"),
  };

  let activeStep = "identity";
  let activeLibrary = "classes";
  let character = loadCharacter();
  const library = {
    classes: [],
    feats: [],
    spells: [],
    items: [],
  };

  function defaultCharacter() {
    return {
      meta: {
        id: `character-${Date.now()}`,
        schema_version: SCHEMA_VERSION,
        app_version: APP_VERSION,
        ruleset: "PF1e",
        enabled_sources: ["CRB"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      identity: {
        name: "",
        player_name: "",
        campaign: "",
        alignment: "",
        deity: "",
        gender: "",
        age: "",
        height: "",
        weight: "",
        background: "",
        portrait: "",
      },
      build: {
        level_total: 1,
        xp: 0,
        mythic_tier: 0,
        size_current: "中型",
        speed_base: 30,
        languages: [],
        favored_class_choices: [],
      },
      race: {
        race_id: "",
        race_name: "",
        subrace_id: "",
        size: "中型",
        base_speed: 30,
        ability_modifiers: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        racial_traits: [],
        alternate_traits: [],
        bonus_languages: [],
        source: "",
      },
      ability_scores: {
        base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        racial_modifiers: {},
        level_increases: [],
        inherent_bonuses: {},
        enhancement_bonuses: {},
        temporary_modifiers: {},
        manual_adjustments: {},
      },
      classes: [],
      level_history: [],
      traits: {
        campaign_traits: [],
        social_traits: [],
        combat_traits: [],
        magic_traits: [],
        faith_traits: [],
        drawbacks: [],
      },
      skills: {
        ranks: {},
        class_skill_overrides: [],
        armor_check_penalty_enabled: true,
        custom_modifiers: [],
      },
      feats: { selected_feats: [] },
      spells: { casting_classes: [], selected_spells: [] },
      equipment: {
        currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
        inventory: [],
      },
      combat: {
        initiative_modifiers: [],
        natural_armor_sources: [],
        damage_reduction: [],
        energy_resistance: [],
        conditions: [],
        active_buffs: [],
        attack_profiles: [],
      },
      resources: [],
      notes: {
        appearance: "",
        personality: "",
        backstory: "",
        gm_notes: "",
        player_notes: "",
        skill_notes: "",
      },
      overrides: [],
      derived: {},
      validation: { errors: [], warnings: [], todos: [] },
    };
  }

  function loadCharacter() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultCharacter();
      return mergeCharacter(defaultCharacter(), JSON.parse(raw));
    } catch (_) {
      return defaultCharacter();
    }
  }

  function mergeCharacter(base, incoming) {
    const normalized = normalizeCharacterInput(incoming);
    const merged = { ...base, ...(normalized || {}) };
    merged.meta = { ...base.meta, ...(normalized && normalized.meta ? normalized.meta : {}) };
    merged.meta.schema_version = SCHEMA_VERSION;
    merged.meta.updated_at = new Date().toISOString();
    merged.identity = { ...base.identity, ...(normalized && normalized.identity ? normalized.identity : {}) };
    merged.build = { ...base.build, ...(normalized && normalized.build ? normalized.build : {}) };
    merged.race = { ...base.race, ...(normalized && normalized.race ? normalized.race : {}) };
    merged.ability_scores = { ...base.ability_scores, ...(normalized && normalized.ability_scores ? normalized.ability_scores : {}) };
    merged.ability_scores.base = { ...base.ability_scores.base, ...(merged.ability_scores.base || {}) };
    merged.classes = Array.isArray(merged.classes) ? merged.classes : [];
    merged.level_history = Array.isArray(merged.level_history) ? merged.level_history : [];
    merged.traits = { ...base.traits, ...(normalized && normalized.traits ? normalized.traits : {}) };
    merged.skills = { ...base.skills, ...(normalized && normalized.skills ? normalized.skills : {}) };
    merged.skills.ranks = merged.skills.ranks && typeof merged.skills.ranks === "object" && !Array.isArray(merged.skills.ranks) ? merged.skills.ranks : {};
    merged.feats = { ...base.feats, ...(normalized && normalized.feats ? normalized.feats : {}) };
    merged.feats.selected_feats = Array.isArray(merged.feats.selected_feats) ? merged.feats.selected_feats : [];
    merged.spells = { ...base.spells, ...(normalized && normalized.spells ? normalized.spells : {}) };
    merged.spells.casting_classes = Array.isArray(merged.spells.casting_classes) ? merged.spells.casting_classes : [];
    merged.spells.selected_spells = Array.isArray(merged.spells.selected_spells) ? merged.spells.selected_spells : [];
    merged.equipment = { ...base.equipment, ...(normalized && normalized.equipment ? normalized.equipment : {}) };
    merged.equipment.currency = { ...base.equipment.currency, ...(merged.equipment.currency || {}) };
    merged.equipment.inventory = Array.isArray(merged.equipment.inventory) ? merged.equipment.inventory : [];
    merged.combat = { ...base.combat, ...(normalized && normalized.combat ? normalized.combat : {}) };
    merged.resources = Array.isArray(merged.resources) ? merged.resources : [];
    merged.notes = { ...base.notes, ...(normalized && normalized.notes ? normalized.notes : {}) };
    merged.overrides = Array.isArray(merged.overrides) ? merged.overrides : [];
    merged.derived = merged.derived && typeof merged.derived === "object" ? merged.derived : {};
    merged.validation = { ...base.validation, ...(normalized && normalized.validation ? normalized.validation : {}) };
    merged.validation.errors = Array.isArray(merged.validation.errors) ? merged.validation.errors : [];
    merged.validation.warnings = Array.isArray(merged.validation.warnings) ? merged.validation.warnings : [];
    merged.validation.todos = Array.isArray(merged.validation.todos) ? merged.validation.todos : [];
    return merged;
  }

  function normalizeCharacterInput(incoming) {
    if (!incoming || typeof incoming !== "object") return {};
    if (incoming.meta && incoming.meta.schema_version) return incoming;
    return {};
  }

  function librarySelectionToStoredItem(item) {
    return {
      id: item.sourceId || item.id || "",
      name: item.name || "",
      meta: item.meta || "",
      detail: item.detail || "",
    };
  }

  function librarySelectionToFeat(item) {
    return {
      feat_id: item.sourceId || item.id || "",
      name: item.name || "",
      source_type: "custom",
      gained_at_level: 0,
      granted_by: "library",
      choices: {},
      meta: item.meta || "",
      detail: item.detail || "",
    };
  }

  function saveCharacter() {
    recalculateCharacter();
    character.meta.updated_at = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
    els.saveStatus.textContent = `已保存 ${new Date().toLocaleTimeString()}`;
    renderSummary();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function abilityMod(score) {
    return Math.floor((Number(score || 10) - 10) / 2);
  }

  function signed(value) {
    return value >= 0 ? `+${value}` : String(value);
  }

  function numberOrZero(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num : 0;
  }

  function positiveInt(value, fallback = 1) {
    const num = Math.floor(Number(value || fallback));
    return Number.isFinite(num) && num > 0 ? num : fallback;
  }

  function currentSizeModifiers() {
    const size = String(character.build.size_current || character.race.size || "中型").toLowerCase();
    return SIZE_MODIFIERS[size] || SIZE_MODIFIERS[character.build.size_current] || SIZE_MODIFIERS[character.race.size] || SIZE_MODIFIERS["中型"];
  }

  function sumEnabledOverrides(target) {
    return (character.overrides || [])
      .filter((item) => item && item.enabled !== false && item.target === target)
      .reduce((sum, item) => sum + numberOrZero(item.value), 0);
  }

  function calculateAbilityScores() {
    const result = {};
    ABILITIES.forEach(([key]) => {
      const base = numberOrZero(character.ability_scores.base[key] || 10);
      const racial = numberOrZero(character.race.ability_modifiers && character.race.ability_modifiers[key]);
      const manual = numberOrZero(character.ability_scores.manual_adjustments && character.ability_scores.manual_adjustments[key]);
      const temporary = numberOrZero(character.ability_scores.temporary_modifiers && character.ability_scores.temporary_modifiers[key]);
      const enhancement = numberOrZero(character.ability_scores.enhancement_bonuses && character.ability_scores.enhancement_bonuses[key]);
      const inherent = numberOrZero(character.ability_scores.inherent_bonuses && character.ability_scores.inherent_bonuses[key]);
      const score = base + racial + manual + temporary + enhancement + inherent;
      result[key] = {
        base,
        racial,
        manual,
        temporary,
        enhancement,
        inherent,
        score,
        modifier: abilityMod(score),
      };
    });
    return result;
  }

  function calculateClassSummary() {
    const entries = character.classes.map((item) => ({
      class_id: item.class_id || "",
      class_name: classDisplayName(item),
      level: positiveInt(item.level, 1),
      source: item.source || "",
    }));
    const total_level = entries.reduce((sum, item) => sum + item.level, 0);
    return { total_level, entries };
  }

  function calculateHpDerived(abilities, classSummary) {
    const con = abilities.con ? abilities.con.modifier : 0;
    return {
      level_total: classSummary.total_level,
      con_modifier_per_level: con,
      con_modifier_total: con * classSummary.total_level,
      manual_adjustment: sumEnabledOverrides("hp"),
    };
  }

  function calculateCombatDerived(abilities, classSummary) {
    const str = abilities.str ? abilities.str.modifier : 0;
    const dex = abilities.dex ? abilities.dex.modifier : 0;
    const con = abilities.con ? abilities.con.modifier : 0;
    const size = currentSizeModifiers();
    const bab = sumEnabledOverrides("bab");
    return {
      initiative: dex,
      bab,
      cmb: bab + str + size.combat + sumEnabledOverrides("cmb"),
      cmd: 10 + bab + str + dex + size.combat + sumEnabledOverrides("cmd"),
      hp_per_level_con_modifier: con,
      level_total_from_classes: classSummary.total_level,
      size_modifier: size.combat,
    };
  }

  function calculateAcDerived(abilities) {
    const dex = abilities.dex ? abilities.dex.modifier : 0;
    const size = currentSizeModifiers();
    const natural = (character.combat.natural_armor_sources || []).reduce((sum, item) => {
      if (!item) return sum;
      if (typeof item === "number") return sum + numberOrZero(item);
      return sum + numberOrZero(item.value || item.bonus);
    }, 0);
    const total = 10 + dex + size.ac + natural + sumEnabledOverrides("ac");
    return {
      total,
      touch: 10 + dex + size.ac + sumEnabledOverrides("ac.touch"),
      flat_footed: 10 + size.ac + natural + sumEnabledOverrides("ac.flat_footed"),
      dex_modifier: dex,
      size_modifier: size.ac,
      natural_armor: natural,
    };
  }

  function calculateSavesDerived(abilities) {
    return {
      fortitude: { total: (abilities.con ? abilities.con.modifier : 0) + sumEnabledOverrides("saves.fortitude"), base: 0, ability: "con" },
      reflex: { total: (abilities.dex ? abilities.dex.modifier : 0) + sumEnabledOverrides("saves.reflex"), base: 0, ability: "dex" },
      will: { total: (abilities.wis ? abilities.wis.modifier : 0) + sumEnabledOverrides("saves.will"), base: 0, ability: "wis" },
    };
  }

  function calculateSkillsDerived(abilities) {
    const ranks = character.skills.ranks || {};
    const result = {};
    Object.entries(ranks).forEach(([skill, value]) => {
      const rankValue = typeof value === "object" && value !== null ? numberOrZero(value.ranks) : numberOrZero(value);
      const abilityKey = typeof value === "object" && value !== null ? value.ability : "";
      const abilityModifier = abilityKey && abilities[abilityKey] ? abilities[abilityKey].modifier : 0;
      result[skill] = {
        ranks: rankValue,
        ability: abilityKey,
        ability_modifier: abilityModifier,
        total: rankValue + abilityModifier + sumEnabledOverrides(`skills.${skill}`),
      };
    });
    return result;
  }

  function calculateSpellDcs(abilities) {
    const result = {};
    (character.spells.casting_classes || []).forEach((item) => {
      const key = item.class_id || item.class_name || item.name;
      if (!key) return;
      const abilityKey = item.casting_ability || item.ability || "";
      const abilityModifier = abilityKey && abilities[abilityKey] ? abilities[abilityKey].modifier : 0;
      result[key] = {
        ability: abilityKey,
        base_dc: 10 + abilityModifier,
        by_spell_level: {},
      };
    });
    return result;
  }

  function calculateCarryingCapacity(abilities) {
    return {
      strength_score: abilities.str ? abilities.str.score : 10,
      note: "负重表尚未接入，当前只缓存力量值供后续计算使用。",
    };
  }

  function calculateValidation(classSummary) {
    const errors = [];
    const warnings = [];
    const todos = [];
    const declaredLevel = positiveInt(character.build.level_total, 1);

    if (!character.identity.name.trim()) {
      warnings.push({ code: "missing_name", message: "尚未填写角色名。", path: "identity.name" });
    }
    if (!character.race.race_name.trim()) {
      warnings.push({ code: "missing_race", message: "尚未填写种族。", path: "race.race_name" });
    }
    if (!character.classes.length) {
      errors.push({ code: "missing_class", message: "尚未选择职业。", path: "classes" });
    }
    if (character.classes.length && classSummary.total_level !== declaredLevel) {
      warnings.push({
        code: "class_level_mismatch",
        message: `职业等级合计为 ${classSummary.total_level}，角色等级为 ${declaredLevel}。`,
        path: "classes",
      });
    }
    if (!character.feats.selected_feats.length) {
      todos.push({ code: "missing_feat", message: "尚未选择专长。", path: "feats.selected_feats" });
    }
    return { errors, warnings, todos };
  }

  function recalculateCharacter() {
    const ability_scores = calculateAbilityScores();
    const class_summary = calculateClassSummary();
    const hp = calculateHpDerived(ability_scores, class_summary);
    const combat = calculateCombatDerived(ability_scores, class_summary);
    const ac = calculateAcDerived(ability_scores);
    const saves = calculateSavesDerived(ability_scores);
    const skills = calculateSkillsDerived(ability_scores);
    const spell_dcs = calculateSpellDcs(ability_scores);
    const carrying_capacity = calculateCarryingCapacity(ability_scores);
    character.derived = {
      ...(character.derived || {}),
      calculation_version: SCHEMA_VERSION,
      calculated_at: new Date().toISOString(),
      ability_scores,
      class_summary,
      hp,
      bab: combat.bab,
      cmb: combat.cmb,
      cmd: combat.cmd,
      combat,
      ac,
      saves,
      skills,
      attacks: character.derived && Array.isArray(character.derived.attacks) ? character.derived.attacks : [],
      spell_dcs,
      carrying_capacity,
    };
    character.validation = calculateValidation(class_summary);
  }

  function setByPath(path, value) {
    const parts = path.split(".");
    let target = character;
    while (parts.length > 1) target = target[parts.shift()];
    target[parts[0]] = value;
    if (path === "race.size") character.build.size_current = value;
    if (path === "race.base_speed") character.build.speed_base = Number(value || 0);
    recalculateCharacter();
    saveCharacter();
    renderStep();
  }

  function displayName(row) {
    return row.name_cn || row.name_zh || row.name || row.name_en || row.name_raw || row.title || "未命名";
  }

  function classDisplayName(row) {
    return row.class_name || row.name || row.class_id || "未命名职业";
  }

  function shortText(value, length = 140) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > length ? `${text.slice(0, length)}...` : text;
  }

  function renderNav() {
    els.stepList.innerHTML = STEPS.map(([id, label]) => (
      `<button type="button" class="step-btn${id === activeStep ? " active" : ""}" data-step="${id}">${label}</button>`
    )).join("");
  }

  function renderSummary() {
    const classText = character.classes.length
      ? character.classes.map((item) => `${classDisplayName(item)} ${item.level}`).join(" / ")
      : "未选职业";
    els.quickSummary.innerHTML = [
      character.identity.name || "未命名角色",
      `等级 ${character.build.level_total || 1}`,
      classText,
      `${character.feats.selected_feats.length} 专长`,
      `${character.spells.selected_spells.length} 法术`,
      `${character.equipment.inventory.length} 奇物`,
    ].map((item) => `<span class="summary-pill">${escapeHtml(item)}</span>`).join("");
  }

  function renderStep() {
    recalculateCharacter();
    const meta = STEPS.find(([id]) => id === activeStep) || STEPS[0];
    els.stepTitle.textContent = meta[1];
    els.stepSubtitle.textContent = meta[2];
    renderNav();
    renderSummary();
    const renderers = {
      identity: renderIdentity,
      abilities: renderAbilities,
      classes: renderClasses,
      skills: renderSkills,
      feats: () => renderCollection("feats", "已选专长"),
      spells: () => renderCollection("spells", "已选法术"),
      items: () => renderCollection("items", "已选奇物"),
      combat: renderCombat,
      validation: renderValidation,
      export: renderExport,
    };
    els.content.innerHTML = renderers[activeStep]();
    bindStepEvents();
  }

  function renderIdentity() {
    const i = character.identity;
    const b = character.build;
    const r = character.race;
    return `
      <div class="form-grid">
        ${field("角色名", "identity.name", i.name)}
        ${field("玩家", "identity.player_name", i.player_name)}
        ${field("角色等级", "build.level_total", b.level_total, "number", "1")}
        ${field("种族", "race.race_name", r.race_name)}
        ${field("阵营", "identity.alignment", i.alignment)}
        ${field("信仰", "identity.deity", i.deity)}
        ${field("体型", "race.size", r.size)}
        ${field("速度", "race.base_speed", r.base_speed, "number", "0")}
      </div>
      <div class="field" style="margin-top:12px">
        <label>角色备注</label>
        <textarea data-path="notes.player_notes">${escapeHtml(character.notes.player_notes)}</textarea>
      </div>
    `;
  }

  function field(label, path, value, type = "text", min = "") {
    const minAttr = min === "" ? "" : ` min="${escapeHtml(min)}"`;
    return `
      <div class="field">
        <label>${escapeHtml(label)}</label>
        <input data-path="${escapeHtml(path)}" type="${type}" value="${escapeHtml(value)}"${minAttr}>
      </div>
    `;
  }

  function renderAbilities() {
    recalculateCharacter();
    const rows = ABILITIES.map(([key, label]) => {
      const score = Number(character.ability_scores.base[key] || 10);
      const derived = character.derived.ability_scores && character.derived.ability_scores[key];
      return `
        <tr>
          <td>${label}</td>
          <td><input data-ability="${key}" type="number" min="1" value="${score}"></td>
          <td>${signed(derived ? derived.modifier : abilityMod(score))}</td>
        </tr>
      `;
    }).join("");
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>属性</th><th>分数</th><th>调整值</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderClasses() {
    return `
      <div class="inline-actions">
        <input id="manual-class-name" type="text" placeholder="职业名称">
        <input id="manual-class-level" type="number" min="1" value="1">
        <button id="add-manual-class" type="button" class="compact-btn">添加职业等级</button>
      </div>
      ${renderClassList()}
    `;
  }

  function renderClassList() {
    if (!character.classes.length) {
      return `<div class="selected-item"><div><div class="selected-title">尚未选择职业</div><p class="selected-meta">可从右侧职业资料添加，也可手动输入。</p></div></div>`;
    }
    const rows = character.classes.map((item, index) => `
      <div class="selected-item">
        <div>
          <div class="selected-title">${escapeHtml(classDisplayName(item))} ${escapeHtml(item.level)}</div>
          <p class="selected-meta">${escapeHtml(item.source || "手动添加")}</p>
          <label class="inline-edit-label">等级
            <input class="inline-level-input" data-class-level="${index}" type="number" min="1" value="${escapeHtml(item.level || 1)}">
          </label>
        </div>
        <button type="button" class="remove-btn" data-remove-class="${index}">移除</button>
      </div>
    `).join("");
    return `<div class="item-list">${rows}</div>`;
  }

  function renderSkills() {
    return `
      <div class="field">
        <label>技能记录</label>
        <textarea data-path="notes.skill_notes" placeholder="先记录技能点分配、职业技能、常用检定。后续迭代会加入完整技能表。">${escapeHtml(character.notes.skill_notes)}</textarea>
      </div>
    `;
  }

  function getSelectionList(key) {
    if (key === "feats") return character.feats.selected_feats;
    if (key === "spells") return character.spells.selected_spells;
    if (key === "items") return character.equipment.inventory;
    return [];
  }

  function renderCollection(key, title) {
    const items = getSelectionList(key);
    if (!items.length) {
      return `<div class="selected-item"><div><div class="selected-title">${title}</div><p class="selected-meta">尚未添加。请从右侧资料浏览器搜索并加入。</p></div></div>`;
    }
    return `<div class="item-list">${items.map((item, index) => `
      <div class="selected-item">
        <div>
          <div class="selected-title">${escapeHtml(item.name)}</div>
          <p class="selected-meta">${escapeHtml(item.meta || "")}</p>
          ${item.detail ? `<p class="selected-meta">${escapeHtml(shortText(item.detail, 180))}</p>` : ""}
        </div>
        <button type="button" class="remove-btn" data-remove="${key}:${index}">移除</button>
      </div>
    `).join("")}</div>`;
  }

  function renderCombat() {
    recalculateCharacter();
    const combat = character.derived.combat || {};
    const classSummary = character.derived.class_summary || { total_level: 0, entries: [] };
    const hp = character.derived.hp || {};
    const ac = character.derived.ac || {};
    const saves = character.derived.saves || {};
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>项目</th><th>当前基础值</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td>先攻</td><td>${signed(combat.initiative || 0)}</td><td>来自敏捷调整值。</td></tr>
            <tr><td>BAB</td><td>${signed(character.derived.bab || 0)}</td><td>当前阶段未接职业 BAB 表，可通过 overrides 先人工修正。</td></tr>
            <tr><td>CMB</td><td>${signed(character.derived.cmb || 0)}</td><td>BAB + 力量调整值 + 体型修正。</td></tr>
            <tr><td>CMD</td><td>${character.derived.cmd || 10}</td><td>10 + BAB + 力量调整值 + 敏捷调整值 + 体型修正。</td></tr>
            <tr><td>AC</td><td>${ac.total || 10}</td><td>10 + 敏捷调整值 + 体型修正 + 天生防御。</td></tr>
            <tr><td>接触 AC</td><td>${ac.touch || 10}</td><td>10 + 敏捷调整值 + 体型修正。</td></tr>
            <tr><td>措手不及 AC</td><td>${ac.flat_footed || 10}</td><td>10 + 体型修正 + 天生防御。</td></tr>
            <tr><td>强韧</td><td>${signed(saves.fortitude ? saves.fortitude.total : 0)}</td><td>当前只接体质调整值与 overrides。</td></tr>
            <tr><td>反射</td><td>${signed(saves.reflex ? saves.reflex.total : 0)}</td><td>当前只接敏捷调整值与 overrides。</td></tr>
            <tr><td>意志</td><td>${signed(saves.will ? saves.will.total : 0)}</td><td>当前只接感知调整值与 overrides。</td></tr>
            <tr><td>每级 HP 修正</td><td>${signed(combat.hp_per_level_con_modifier || 0)}</td><td>来自体质调整值。</td></tr>
            <tr><td>HP 体质修正合计</td><td>${signed(hp.con_modifier_total || 0)}</td><td>职业等级合计 × 体质调整值。</td></tr>
            <tr><td>职业等级合计</td><td>${combat.level_total_from_classes || 0}</td><td>来自已选职业等级。</td></tr>
          </tbody>
        </table>
      </div>
      <div class="derived-note">
        <div class="selected-title">derived 计算层</div>
        <p>当前已写入 <code>derived.ability_scores</code>、<code>derived.class_summary</code>、<code>derived.hp</code>、<code>derived.bab</code>、<code>derived.cmb</code>、<code>derived.cmd</code>、<code>derived.ac</code>、<code>derived.saves</code>、<code>derived.skills</code>、<code>derived.spell_dcs</code>、<code>derived.carrying_capacity</code> 和 <code>validation</code>。</p>
        <p>职业等级合计：${classSummary.total_level || 0}；职业数：${classSummary.entries.length || 0}。</p>
      </div>
    `;
  }

  function renderValidation() {
    recalculateCharacter();
    const validation = character.validation || { errors: [], warnings: [], todos: [] };
    const issues = [
      ...validation.errors.map((item) => ["danger", item.message]),
      ...validation.warnings.map((item) => ["warn", item.message]),
      ...validation.todos.map((item) => ["", item.message]),
    ];
    if (!issues.length) issues.push(["", "第一层校验未发现明显问题。后续会加入先决条件、技能点、法术环位等规则校验。"]);
    return `<div class="item-list">${issues.map(([type, text]) => `
      <div class="validation-row ${type}"><div class="selected-title">${type === "danger" ? "严重" : type === "warn" ? "提醒" : "通过"}</div><p>${escapeHtml(text)}</p></div>
    `).join("")}</div>`;
  }

  function renderExport() {
    return `
      <div class="inline-actions">
        <button id="copy-json-btn" type="button" class="compact-btn">复制 JSON</button>
      </div>
      <textarea id="export-json-text" class="export-box" readonly>${escapeHtml(JSON.stringify(character, null, 2))}</textarea>
    `;
  }

  function bindStepEvents() {
    els.content.querySelectorAll("[data-path]").forEach((input) => {
      input.addEventListener("change", () => {
        const value = input.type === "number" ? Number(input.value || 0) : input.value;
        setByPath(input.dataset.path, value);
      });
    });
    els.content.querySelectorAll("[data-ability]").forEach((input) => {
      input.addEventListener("change", () => {
        character.ability_scores.base[input.dataset.ability] = Number(input.value || 10);
        saveCharacter();
        renderStep();
      });
    });
    const addManualClass = document.getElementById("add-manual-class");
    if (addManualClass) {
      addManualClass.addEventListener("click", () => {
        const name = document.getElementById("manual-class-name").value.trim();
        const level = Number(document.getElementById("manual-class-level").value || 1);
        if (!name) return;
        character.classes.push({ class_id: "", class_name: name, level, archetypes: [], favored_class: false, source: "手动添加" });
        saveCharacter();
        renderStep();
      });
    }
    els.content.querySelectorAll("[data-remove-class]").forEach((button) => {
      button.addEventListener("click", () => {
        character.classes.splice(Number(button.dataset.removeClass), 1);
        saveCharacter();
        renderStep();
      });
    });
    els.content.querySelectorAll("[data-class-level]").forEach((input) => {
      input.addEventListener("change", () => {
        const index = Number(input.dataset.classLevel);
        if (!character.classes[index]) return;
        character.classes[index].level = Math.max(1, Number(input.value || 1));
        saveCharacter();
        renderStep();
      });
    });
    els.content.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const [key, index] = button.dataset.remove.split(":");
        getSelectionList(key).splice(Number(index), 1);
        saveCharacter();
        renderStep();
      });
    });
    const copyJson = document.getElementById("copy-json-btn");
    if (copyJson) {
      copyJson.addEventListener("click", async () => {
        recalculateCharacter();
        await navigator.clipboard.writeText(JSON.stringify(character, null, 2));
        els.saveStatus.textContent = "已复制 JSON";
      });
    }
  }

  function bindGlobalEvents() {
    els.stepList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-step]");
      if (!button) return;
      activeStep = button.dataset.step;
      renderStep();
    });
    els.newBtn.addEventListener("click", () => {
      if (!confirm("确定新建角色？当前本地角色卡会被清空。")) return;
      character = defaultCharacter();
      saveCharacter();
      renderStep();
    });
    els.exportBtn.addEventListener("click", () => {
      recalculateCharacter();
      const blob = new Blob([JSON.stringify(character, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${character.identity.name || "pf-character"}.json`;
      link.click();
      URL.revokeObjectURL(url);
    });
    els.importInput.addEventListener("change", async () => {
      const file = els.importInput.files && els.importInput.files[0];
      if (!file) return;
      try {
        const imported = JSON.parse(await file.text());
        character = mergeCharacter(defaultCharacter(), imported);
        saveCharacter();
        renderStep();
      } catch (error) {
        alert(`导入失败：${error.message}`);
      } finally {
        els.importInput.value = "";
      }
    });
    els.libraryTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-library]");
      if (!button) return;
      activeLibrary = button.dataset.library;
      els.libraryTabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      renderLibrary();
    });
    els.librarySearch.addEventListener("input", renderLibrary);
    els.libraryResults.addEventListener("click", (event) => {
      const button = event.target.closest("[data-add-library]");
      if (!button) return;
      addLibraryItem(button.dataset.addLibrary, Number(button.dataset.index));
    });
  }

  async function loadLibrary() {
    els.libraryStatus.textContent = "加载中...";
    const tasks = [
      loadJson("/result/classes/classes-extracted.json").then((data) => {
        library.classes = normalizeClasses(data);
      }),
      loadJson("/result/feats/feats-frontend.json").then((data) => {
        library.feats = (Array.isArray(data.feats) ? data.feats : []).map(normalizeFeat);
      }),
      loadJson("/result/items/wondrous-items.json").then((data) => {
        library.items = (Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []).map(normalizeItem);
      }),
      loadSpells().then((spells) => {
        library.spells = spells.map(normalizeSpell);
      }),
    ];
    await Promise.allSettled(tasks);
    els.libraryStatus.textContent = `职业 ${library.classes.length} / 专长 ${library.feats.length} / 法术 ${library.spells.length} / 奇物 ${library.items.length}`;
    renderLibrary();
  }

  async function loadJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function loadSpells() {
    let sources = SPELL_FALLBACK_SOURCES;
    try {
      const sourceData = await loadJson("/api/spell-sources");
      const paths = Array.isArray(sourceData.sources) ? sourceData.sources.map((item) => item.path).filter(Boolean) : [];
      if (paths.length) sources = paths;
    } catch (_) {
      sources = SPELL_FALLBACK_SOURCES;
    }
    const datasets = await Promise.allSettled(sources.map((url) => loadJson(url)));
    return datasets.flatMap((result) => result.status === "fulfilled" && Array.isArray(result.value) ? result.value : []);
  }

  function normalizeClasses(data) {
    const rows = [];
    const source = Array.isArray(data.classes) ? data.classes : Array.isArray(data) ? data : Object.values(data || {}).flat();
    source.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      rows.push({
        id: item.class_id || item.id || `class-${index}`,
        name: item.name_cn || item.name || item.name_en || item.title || "未命名职业",
        meta: [item.section, item.hit_die, item.role].filter(Boolean).join(" / "),
        detail: item.description || item.intro || item.detail_text || "",
        raw: item,
      });
    });
    return rows;
  }

  function normalizeFeat(item) {
    const name = item.name_cn && item.name_en ? `${item.name_cn}（${item.name_en}）` : displayName(item);
    return {
      id: item.feat_id || item.match_key || name,
      name,
      meta: Array.isArray(item.books) ? item.books.join("、") : item.source_book || "",
      detail: item.benefit_summary || item.detail_text || item.prerequisites || "",
      raw: item,
    };
  }

  function normalizeSpell(item) {
    return {
      id: item.spell_id || item.name || `${item.source_book || item.source || "spell"}-${Math.random()}`,
      name: displayName(item),
      meta: [item.source_book || item.source, item.level_raw || item["等级"], item.school || item["学派"]].filter(Boolean).join(" / "),
      detail: item.effect || item["效果"] || item.raw_fields && item.raw_fields["效果"] || "",
      raw: item,
    };
  }

  function normalizeItem(item) {
    const name = item.name_cn && item.name_en ? `${item.name_cn}（${item.name_en}）` : displayName(item);
    return {
      id: item.item_id || item.name_raw || name,
      name,
      meta: [item.slot, item.price, item.source_book].filter(Boolean).join(" / "),
      detail: item.detail_text || item.effect || item.description || "",
      raw: item,
    };
  }

  function renderLibrary() {
    const query = normalize(els.librarySearch.value);
    const rows = library[activeLibrary] || [];
    const filtered = rows.filter((item) => {
      if (!query) return true;
      return normalize([item.name, item.meta, item.detail].join(" ")).includes(query);
    }).slice(0, 60);
    if (!filtered.length) {
      els.libraryResults.innerHTML = `<div class="library-card"><h3>没有匹配资料</h3><p>换一个关键词再试。</p></div>`;
      return;
    }
    els.libraryResults.innerHTML = filtered.map((item) => {
      const sourceIndex = rows.indexOf(item);
      return `
        <article class="library-card">
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.meta || "未标注来源")}</p>
          ${item.detail ? `<p>${escapeHtml(shortText(item.detail))}</p>` : ""}
          <div class="library-add-row">
            ${activeLibrary === "classes" ? `
              <label class="library-level-label">加入等级
                <input class="library-level-input" data-library-level="${sourceIndex}" type="number" min="1" value="1">
              </label>
            ` : ""}
            <button type="button" data-add-library="${activeLibrary}" data-index="${sourceIndex}">加入角色卡</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function addLibraryItem(type, index) {
    const item = library[type] && library[type][index];
    if (!item) return;
    if (type === "classes") {
      const levelInput = els.libraryResults.querySelector(`[data-library-level="${index}"]`);
      const level = Math.max(1, Number(levelInput && levelInput.value ? levelInput.value : 1));
      character.classes.push({
        class_id: item.id || "",
        class_name: item.name,
        level,
        archetypes: [],
        favored_class: false,
        source: item.meta || "资料库",
      });
      activeStep = "classes";
    } else {
      if (type === "feats") {
        character.feats.selected_feats.push(librarySelectionToFeat({ ...item, sourceId: item.id }));
        activeStep = "feats";
      } else if (type === "spells") {
        character.spells.selected_spells.push(librarySelectionToStoredItem({ ...item, sourceId: item.id }));
        activeStep = "spells";
      } else {
        character.equipment.inventory.push({
          item_id: item.id || "",
          name: item.name,
          quantity: 1,
          weight: 0,
          value_gp: 0,
          container: "",
          equipped: false,
          slot: "",
          enhancements: [],
          custom_modifiers: [],
          meta: item.meta || "",
          detail: item.detail || "",
        });
        activeStep = "items";
      }
    }
    saveCharacter();
    renderStep();
  }

  bindGlobalEvents();
  recalculateCharacter();
  renderStep();
  loadLibrary();
})();
