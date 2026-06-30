# PF 角色卡数据结构设计

本文档定义 PF 车卡器第一版使用的角色卡数据结构。它描述的是程序内部保存、计算和校验角色的结构，不是最终打印出来的纸质角色卡版式。

核心原则：

- 保存玩家的选择，最终数值由规则引擎计算。
- `derived` 是计算缓存，可以删除后重新生成。
- 所有加值、能力、专长、装备都尽量保留来源，方便追踪错误。
- 第一版优先支持稳定的核心流程，复杂规则后续扩展。

## 1. 顶层结构

建议角色 JSON 顶层结构如下：

```json
{
  "meta": {},
  "identity": {},
  "build": {},
  "race": {},
  "ability_scores": {},
  "classes": [],
  "level_history": [],
  "traits": {},
  "skills": {},
  "feats": {},
  "spells": {},
  "equipment": {},
  "combat": {},
  "resources": [],
  "notes": {},
  "overrides": [],
  "derived": {},
  "validation": {}
}
```

## 2. 设计约定

### 选择与计算结果分离

角色卡中应该区分两类数据：

- `choices`：玩家做出的选择，例如种族、职业、属性、技能点、专长、装备。
- `derived`：系统根据选择计算出的结果，例如 AC、BAB、豁免、技能总值、攻击加值。

系统的真实数据来源应该是 `choices`。`derived` 只用于展示、导出和加速读取。

### 来源追踪

PF 中大量数值来自不同来源。每个加值最好都能记录：

- 来源名称。
- 来源类型。
- 加值类型。
- 目标字段。
- 是否启用。

例如：

```json
{
  "target": "ac.armor",
  "value": 4,
  "bonus_type": "armor",
  "source": "链甲衫",
  "enabled": true
}
```

### 人工修正保留

PF 特例很多，必须允许用户人工修正。但人工修正不能直接覆盖原始计算逻辑，应统一保存在 `overrides` 中，并写明原因。

## 3. meta：元信息

用于版本管理、保存、兼容和数据迁移。

```json
{
  "id": "character-uuid",
  "schema_version": "0.1.0",
  "app_version": "1.2.2",
  "ruleset": "PF1e",
  "enabled_sources": ["CRB", "APG"],
  "created_at": "2026-06-15T12:00:00+08:00",
  "updated_at": "2026-06-15T12:00:00+08:00"
}
```

字段说明：

- `id`：角色唯一 ID。
- `schema_version`：角色卡结构版本，用于后续迁移。
- `app_version`：创建或最后保存时的程序版本。
- `ruleset`：规则系统，第一版固定为 `PF1e`。
- `enabled_sources`：启用的规则来源书。

## 4. identity：角色身份

主要用于展示，不直接参与大部分计算。

```json
{
  "name": "",
  "player_name": "",
  "campaign": "",
  "alignment": "",
  "deity": "",
  "gender": "",
  "age": "",
  "height": "",
  "weight": "",
  "background": "",
  "portrait": ""
}
```

## 5. build：构筑总览

保存角色当前整体状态。

```json
{
  "level_total": 1,
  "xp": 0,
  "mythic_tier": 0,
  "size_current": "medium",
  "speed_base": 30,
  "languages": [],
  "favored_class_choices": []
}
```

字段说明：

- `level_total`：总角色等级。
- `mythic_tier`：神话阶层，第一版可保留但不实现完整规则。
- `size_current`：当前体型。
- `speed_base`：基础速度，单位建议统一为尺。
- `languages`：已掌握语言。
- `favored_class_choices`：每级天赋职业奖励选择。

## 6. race：种族

种族需要保存 ID、名称、基础能力和替换情况。

```json
{
  "race_id": "human",
  "race_name": "人类",
  "subrace_id": "",
  "size": "medium",
  "base_speed": 30,
  "ability_modifiers": {
    "str": 0,
    "dex": 0,
    "con": 0,
    "int": 0,
    "wis": 0,
    "cha": 0
  },
  "racial_traits": [],
  "alternate_traits": [],
  "bonus_languages": [],
  "source": "CRB"
}
```

设计要求：

- `racial_traits` 保存当前生效的种族特性。
- `alternate_traits` 保存替换种族特性的选择。
- 如果替换了原始特性，应能追踪“替换了什么”和“获得了什么”。

## 7. ability_scores：属性

属性要区分基础值和各种修正来源。

```json
{
  "base": {
    "str": 10,
    "dex": 10,
    "con": 10,
    "int": 10,
    "wis": 10,
    "cha": 10
  },
  "racial_modifiers": {},
  "level_increases": [],
  "inherent_bonuses": {},
  "enhancement_bonuses": {},
  "temporary_modifiers": {},
  "manual_adjustments": {}
}
```

计算结果放入 `derived.ability_scores`：

```json
{
  "str": {
    "score": 16,
    "modifier": 3
  }
}
```

## 8. classes：职业汇总

保存角色拥有的职业和等级汇总。

```json
[
  {
    "class_id": "fighter",
    "class_name": "战士",
    "level": 1,
    "archetypes": [],
    "favored_class": true,
    "source": "CRB"
  }
]
```

注意：`classes` 是汇总视图，具体每级选择必须保存在 `level_history`。

## 9. level_history：逐级升级记录

这是车卡器最重要的数据之一。PF 的技能点、HP、专长、职业奖励、职业能力都依赖具体等级。

```json
[
  {
    "level": 1,
    "class_id": "fighter",
    "hp_mode": "max",
    "hp_roll": 10,
    "favored_class_bonus": {
      "type": "hp",
      "value": 1
    },
    "skill_ranks_spent": {},
    "feats_selected": [],
    "class_features_selected": []
  }
]
```

字段说明：

- `level`：角色总等级中的第几级。
- `class_id`：这一级选择的职业。
- `hp_mode`：生命值选择方式，例如 `max`、`roll`、`average`。
- `hp_roll`：实际生命骰结果。
- `favored_class_bonus`：本级天赋职业奖励。
- `skill_ranks_spent`：本级投入的技能点。
- `feats_selected`：本级获得的专长。
- `class_features_selected`：本级需要选择的职业能力。

## 10. traits：特性与角色标签

这里保存非职业、非种族但会影响角色的选择。

```json
{
  "campaign_traits": [],
  "social_traits": [],
  "combat_traits": [],
  "magic_traits": [],
  "faith_traits": [],
  "drawbacks": []
}
```

第一版可以先保留结构，不强制实现全部特性规则。

## 11. skills：技能

技能保存投入点数，而不是最终总值。

```json
{
  "ranks": {
    "acrobatics": 0,
    "perception": 0,
    "spellcraft": 0
  },
  "class_skill_overrides": [],
  "armor_check_penalty_enabled": true,
  "custom_modifiers": []
}
```

计算公式示例：

```text
技能总值 = 属性修正 + 技能点 + 职业技能加值 + 护甲减值 + 其他修正
```

计算结果放入 `derived.skills`。

## 12. feats：专长

专长必须记录来源和获得等级。

```json
{
  "selected_feats": [
    {
      "feat_id": "power_attack",
      "name": "猛力攻击",
      "source_type": "level",
      "gained_at_level": 1,
      "granted_by": "",
      "choices": {}
    }
  ]
}
```

字段说明：

- `source_type`：来源类型，例如 `level`、`class_bonus`、`race_bonus`、`mythic`、`custom`。
- `gained_at_level`：获得该专长时的角色等级。
- `granted_by`：由哪个职业能力、种族能力或规则给予。
- `choices`：专长子选择，例如武器专攻选择哪种武器。

前置条件校验不建议保存在专长对象中，应由校验系统实时生成。

## 13. spells：法术

法术系统要支持多种施法职业。第一版先采用通用结构。

```json
{
  "casting_classes": [
    {
      "class_id": "wizard",
      "caster_level": 1,
      "casting_ability": "int",
      "concentration_bonus": 0,
      "spell_dc_base": 10,
      "slots": {},
      "spells_known": [],
      "spells_prepared": [],
      "spellbook": [],
      "domains": [],
      "bloodline": "",
      "school_specialization": "",
      "opposition_schools": []
    }
  ]
}
```

字段说明：

- `slots`：每日法术位。
- `spells_known`：已知法术。
- `spells_prepared`：准备法术。
- `spellbook`：法术书。
- `domains`：领域。
- `bloodline`：血脉。
- `school_specialization`：法师专精学派。
- `opposition_schools`：对立学派。

不同职业不适用的字段可以留空。

## 14. equipment：装备

装备分为财富、库存和已装备状态。

```json
{
  "currency": {
    "pp": 0,
    "gp": 0,
    "sp": 0,
    "cp": 0
  },
  "inventory": [
    {
      "item_id": "chain_shirt",
      "name": "链甲衫",
      "quantity": 1,
      "weight": 25,
      "value_gp": 100,
      "container": "",
      "equipped": true,
      "slot": "armor",
      "enhancements": [],
      "custom_modifiers": []
    }
  ]
}
```

装备可能影响：

- AC。
- 攻击和伤害。
- 速度。
- 技能护甲减值。
- 负重。
- 豁免。
- 属性。

装备的加值应通过统一 modifier 结构进入计算。

## 15. combat：战斗配置

保存战斗相关的可选配置和攻击配置。

```json
{
  "initiative_modifiers": [],
  "natural_armor_sources": [],
  "damage_reduction": [],
  "energy_resistance": [],
  "conditions": [],
  "active_buffs": [],
  "attack_profiles": [
    {
      "name": "长剑单手",
      "weapon_id": "longsword",
      "ability_to_hit": "str",
      "ability_to_damage": "str",
      "power_attack_enabled": false,
      "two_weapon_fighting_enabled": false
    }
  ]
}
```

## 16. resources：每日资源

保存职业能力、种族能力、物品能力等有限次数资源。

```json
[
  {
    "id": "channel_energy",
    "name": "引导能量",
    "max": 3,
    "current": 3,
    "refresh": "daily",
    "source": "cleric"
  }
]
```

字段说明：

- `max`：最大次数。
- `current`：当前剩余次数。
- `refresh`：恢复周期，例如 `daily`、`encounter`、`manual`。

## 17. notes：备注

用于保存自由文本，不参与计算。

```json
{
  "appearance": "",
  "personality": "",
  "backstory": "",
  "gm_notes": "",
  "player_notes": ""
}
```

## 18. overrides：人工修正

所有人工修正统一保存到这里。

```json
[
  {
    "id": "override-001",
    "target": "skills.perception",
    "value": 2,
    "bonus_type": "custom",
    "reason": "GM 奖励",
    "enabled": true
  }
]
```

字段说明：

- `target`：修正目标。
- `value`：修正数值。
- `bonus_type`：加值类型，例如 `dodge`、`morale`、`enhancement`、`custom`。
- `reason`：原因说明。
- `enabled`：是否启用。

## 19. derived：计算结果缓存

`derived` 由规则引擎生成，不应作为真实来源。

```json
{
  "ability_scores": {},
  "hp": {},
  "bab": 0,
  "cmb": 0,
  "cmd": 10,
  "ac": {},
  "saves": {},
  "skills": {},
  "attacks": [],
  "spell_dcs": {},
  "carrying_capacity": {}
}
```

原则：

- 可以删除并重新计算。
- 不直接由用户编辑。
- 导出角色卡时优先读取这里。

## 20. validation：校验结果

校验结果由系统生成。

```json
{
  "errors": [
    {
      "code": "feat_prerequisite_missing",
      "message": "力量不足 13，不能选择猛力攻击。",
      "path": "feats.selected_feats[0]"
    }
  ],
  "warnings": [
    {
      "code": "skill_points_remaining",
      "message": "还有 2 个技能点未分配。",
      "path": "skills"
    }
  ],
  "todos": [
    {
      "message": "请选择 1 个等级专长。",
      "path": "feats"
    }
  ]
}
```

建议区分：

- `errors`：当前构筑不合法。
- `warnings`：可保存，但可能不完整或有风险。
- `todos`：车卡流程中尚未完成的选择。

## 21. 第一版 MVP 范围

第一版建议至少支持：

- `meta`
- `identity`
- `race`
- `ability_scores`
- `classes`
- `level_history`
- `skills`
- `feats`
- `spells`
- `equipment`
- `overrides`
- `derived`
- `validation`

第一版可以暂缓完整实现：

- 神话阶层完整规则。
- 全部职业变体。
- 动物伙伴、魔宠、召唤物。
- 复杂模板。
- 完整魔法物品联动。
- PDF 精排。

## 22. 后续实现顺序建议

建议按以下顺序实现车卡器：

1. 建立空白角色 JSON。
2. 支持保存、导入、导出 JSON。
3. 实现属性输入与属性调整值计算。
4. 实现种族选择和种族属性修正。
5. 实现职业选择、等级和 BAB/豁免/HP 计算。
6. 实现技能投入和技能总值计算。
7. 实现专长选择和基础前置条件校验。
8. 接入法术选择。
9. 接入装备、AC、攻击和负重计算。
10. 实现完整角色卡预览。
11. 实现 HTML 打印或导出。

## 23. 示例最小角色

```json
{
  "meta": {
    "id": "example-character",
    "schema_version": "0.1.0",
    "ruleset": "PF1e",
    "enabled_sources": ["CRB"]
  },
  "identity": {
    "name": "未命名角色",
    "player_name": ""
  },
  "build": {
    "level_total": 1,
    "mythic_tier": 0
  },
  "race": {
    "race_id": "human",
    "race_name": "人类",
    "size": "medium",
    "base_speed": 30
  },
  "ability_scores": {
    "base": {
      "str": 10,
      "dex": 10,
      "con": 10,
      "int": 10,
      "wis": 10,
      "cha": 10
    }
  },
  "classes": [],
  "level_history": [],
  "skills": {
    "ranks": {}
  },
  "feats": {
    "selected_feats": []
  },
  "spells": {
    "casting_classes": []
  },
  "equipment": {
    "currency": {
      "pp": 0,
      "gp": 0,
      "sp": 0,
      "cp": 0
    },
    "inventory": []
  },
  "overrides": [],
  "derived": {},
  "validation": {
    "errors": [],
    "warnings": [],
    "todos": []
  }
}
```
