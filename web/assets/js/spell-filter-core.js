(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.PFSpellFilterCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const PROFESSION_CANON = {
        '炼金术师': '炼金术师',
        '炼金术士': '炼金术师',
        '练金术师': '炼金术师',
        '炼金师': '炼金术师',
        '调查员': '调查员',
        '调查者': '调查员',
        '反圣骑士': '反圣骑士',
        '反圣武士': '反圣骑士',
        '术士': '术士',
        '法师': '法师',
        '法术': '法师',
        '巫师': '法师',
        '奥能师': '奥能师',
        '奥能者': '奥能师',
        '牧师': '牧师',
        '先知': '先知',
        '战斗祭司': '战斗祭司',
        '战争祭司': '战斗祭司',
        '吟游诗人': '吟游诗人',
        '吟游吟游诗人': '吟游诗人',
        '吟游诗人诗人': '吟游诗人',
        '吟游诗人诗': '吟游诗人',
        '吟游诗': '吟游诗人',
        '游吟诗人': '吟游诗人',
        '诗人': '吟游诗人',
        '唤魂师': '唤魂师',
        '唤魂者': '唤魂师',
        '唤灵师': '唤魂师',
        '唤师师': '唤魂师',
        '魔战士': '魔战士',
        '魔战': '魔战士',
        '召唤师': '召唤师',
        '召唤旒': '召唤师',
        '召唤师 U': '召唤师',
        '召唤师 Unchained': '召唤师',
        '歌者': '歌者',
        '血脉狂怒者': '血脉狂怒者',
        '血脉狂暴者': '血脉狂怒者',
        '血脉暴怒者': '血脉狂怒者',
        '德鲁伊': '德鲁伊',
        '猎人': '猎人',
        '萨满': '萨满',
        '女巫': '女巫',
        '审判者': '审判者',
        '异能者': '异能者',
        '异能师': '异能者',
        '秘学士': '秘学士',
        '密学士': '秘学士',
        '催眠师': '催眠师',
        '惟眠师': '催眠师',
        '通灵者': '通灵者',
        '通灵师': '通灵者',
        '圣武士': '圣骑士',
        '圣骑士': '圣骑士',
        '游侠': '游侠',
        '盗贼': '盗贼',
        '导师': '导师',
        '红螳螂杀手': '红螳螂杀手'
    };

    const PROFESSION_EN_TO_ZH = {
        'sorcerer': '术士',
        'wizard': '法师',
        'arcanist': '奥能师',
        'cleric': '牧师',
        'oracle': '先知',
        'warpriest': '战斗祭司',
        'druid': '德鲁伊',
        'hunter': '猎人',
        'shaman': '萨满',
        'witch': '女巫',
        'summoner': '召唤师',
        'summoner u': '召唤师',
        'summoner unchained': '召唤师',
        'summoner (unchained)': '召唤师',
        'inquisitor': '审判者',
        'psychic': '异能者',
        'occultist': '秘学士',
        'magus': '魔战士',
        'bard': '吟游诗人',
        'skald': '歌者',
        'paladin': '圣骑士',
        'antipaladin': '反圣骑士',
        'ranger': '游侠',
        'rogue': '盗贼',
        'alchemist': '炼金术师',
        'investigator': '调查员',
        'bloodrager': '血脉狂怒者',
        'mesmerist': '催眠师',
        'medium': '通灵者',
        'spiritualist': '通灵者',
        'redmantisassassin': '红螳螂杀手'
    };

    const SCHOOL_CANON = {
        '防护': '防护', '防护系': '防护',
        '咒法': '咒法', '咒法系': '咒法', '召唤': '咒法',
        '预言': '预言', '预言系': '预言',
        '惑控': '惑控', '惑控系': '惑控', '附魔': '惑控',
        '塑能': '塑能', '塑能系': '塑能',
        '幻术': '幻术', '幻术系': '幻术',
        '死灵': '死灵', '死灵系': '死灵',
        '变化': '变化', '变化系': '变化', '变形': '变化',
        '通用': '通用', '通用系': '通用',
        '神话': '神话法术', '神话法术': '神话法术'
    };

    const SCHOOL_ORDER = ['防护', '咒法', '预言', '惑控', '塑能', '幻术', '死灵', '变化', '神话法术', '通用', '其他'];

    function normalizeText(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function pickField(spell, keys) {
        for (const key of keys) {
            const value = spell && spell[key];
            if (value === undefined || value === null) continue;
            if (typeof value === 'string' && !value.trim()) continue;
            return value;
        }
        return '';
    }

    function canonicalizeProfession(name) {
        let cleaned = String(name || '')
            .replace(/[／]/g, '/')
            .replace(/\s*\/\s*/g, '/')
            .replace(/[()（）]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!cleaned) return '';
        const lower = cleaned.toLowerCase();
        const translated = PROFESSION_EN_TO_ZH[lower] || cleaned;
        return PROFESSION_CANON[translated] || translated;
    }

    function splitProfessionNames(value) {
        return String(value || '')
            .replace(/[／]/g, '/')
            .split('/')
            .map(canonicalizeProfession)
            .filter(Boolean)
            .filter(name => !name.includes('领域') && !name.includes('子域'));
    }

    function parseRawLevelEntries(levelText) {
        if (!levelText) return [];
        const normalized = String(levelText)
            .replace(/\n/g, ' ')
            .replace(/[；;]/g, '，')
            .replace(/[、]/g, '，')
            .replace(/([0-9])(?=[\u4e00-\u9fffA-Za-z])/g, '$1，');

        return normalized
            .split(/[，,]/)
            .map(part => part.trim())
            .filter(Boolean)
            .flatMap(part => {
                const match = part.match(/^(.+?)\s*([0-9])(?:\s|$)/);
                if (!match) return [];
                const level = Number(match[2]);
                if (!Number.isInteger(level) || level < 0 || level > 9) return [];
                return splitProfessionNames(match[1]).map(profession => ({ profession, level }));
            });
    }

    function parseStructuredLevelEntries(spell) {
        const arrays = [
            spell && spell.level_by_class,
            spell && spell.class_levels,
            spell && spell['level_by_class'],
            spell && spell['class_levels']
        ];
        const entries = [];
        arrays.forEach(items => {
            if (!Array.isArray(items)) return;
            items.forEach(item => {
                if (!item || typeof item !== 'object') return;
                const rawClass = item.class || item.profession || item['职业'] || '';
                const level = Number(item.level ?? item['环位']);
                if (!rawClass || !Number.isInteger(level) || level < 0 || level > 9) return;
                splitProfessionNames(rawClass).forEach(profession => entries.push({ profession, level }));
            });
        });
        return entries;
    }

    function getClassLevelEntries(spell) {
        const raw = pickField(spell, ['等级', 'level_raw', '等級']);
        const entries = [
            ...parseStructuredLevelEntries(spell),
            ...parseRawLevelEntries(raw)
        ];
        const seen = new Set();
        return entries.filter(entry => {
            const key = `${entry.profession}\u0000${entry.level}`;
            if (!entry.profession || seen.has(key)) return false;
            seen.add(key);
            return true;
        }).sort((a, b) => a.level - b.level || a.profession.localeCompare(b.profession, 'zh-Hans'));
    }

    function isMythicSpell(spell) {
        const type = normalizeText(pickField(spell, ['spell_type', '法术类型', '类型']));
        const source = String(pickField(spell, ['来源', 'source_book', 'source']) || '').toUpperCase();
        return type.includes('mythic') || type.includes('神话') || source === 'MA';
    }

    function canonicalizeSchool(schoolText) {
        const raw = String(schoolText || '')
            .replace(/\[[^\]]*]/g, '')
            .replace(/【[^】]*】/g, '')
            .trim();
        if (!raw) return '其他';
        const direct = ['防护', '咒法', '预言', '惑控', '附魔', '塑能', '幻术', '死灵', '变化', '变形', '神话法术', '神话', '通用']
            .find(name => raw.includes(name));
        if (direct) return SCHOOL_CANON[direct] || direct;
        const first = raw.split(/[，,；;\s]/).filter(Boolean)[0] || raw;
        const normalized = first.replace(/（.*?）|\(.*?\)/g, '').trim();
        return SCHOOL_CANON[normalized] || SCHOOL_CANON[normalized.replace(/系$/, '')] || normalized.replace(/系$/, '') || '其他';
    }

    function deriveDisplayName(spell) {
        const direct = [spell && spell.name_zh, spell && spell['名称'], spell && spell['中文名'], spell && spell['译名']]
            .map(value => String(value || '').trim())
            .find(Boolean);
        if (direct) return direct;
        return String(pickField(spell, ['name', '名称']) || '（未命名）').trim();
    }

    function normalizeSpellRecord(spell, index = 0) {
        if (!spell || typeof spell !== 'object') return null;
        const name = String(pickField(spell, ['name', '名称', '中文名', '译名']) || '').trim();
        if (!name) return null;
        const source = String(pickField(spell, ['来源', 'source_book', 'source']) || '').toUpperCase();
        const school = isMythicSpell(spell)
            ? '神话法术'
            : canonicalizeSchool(pickField(spell, ['学派', 'school']));
        const classLevels = getClassLevelEntries(spell);
        const id = String(spell.spell_id || `${source}:${name}:${index}`);
        return {
            id,
            name,
            displayName: deriveDisplayName(spell),
            source,
            school,
            classLevels,
            raw: spell
        };
    }

    function toSet(value) {
        if (value instanceof Set) return value;
        return new Set(Array.isArray(value) ? value : []);
    }

    /**
     * 分类之间使用 AND；同一分类内部使用 OR。
     * 当“职业”和“环位”同时被选择时，必须由同一个职业-环位条目满足。
     * 例如：法师/术士 3、吟游诗人 4，不会命中“吟游诗人 + 3环”。
     */
    function matchesCombinedFilter(meta, filters) {
        const professions = toSet(filters && filters.professions);
        const schools = toSet(filters && filters.schools);
        const levels = new Set(Array.from(toSet(filters && filters.levels), Number));
        const query = normalizeText(filters && filters.query);

        if (query) {
            const haystack = normalizeText(`${meta.name} ${meta.displayName} ${meta.source} ${meta.school}`);
            if (!haystack.includes(query)) return false;
        }
        if (schools.size && !schools.has(meta.school)) return false;

        const hasProfessions = professions.size > 0;
        const hasLevels = levels.size > 0;
        if (hasProfessions && hasLevels) {
            return meta.classLevels.some(entry => professions.has(entry.profession) && levels.has(entry.level));
        }
        if (hasProfessions) {
            return meta.classLevels.some(entry => professions.has(entry.profession));
        }
        if (hasLevels) {
            return meta.classLevels.some(entry => levels.has(entry.level));
        }
        return true;
    }

    function matchingClassLevels(meta, filters) {
        const professions = toSet(filters && filters.professions);
        const levels = new Set(Array.from(toSet(filters && filters.levels), Number));
        return meta.classLevels.filter(entry => {
            if (professions.size && !professions.has(entry.profession)) return false;
            if (levels.size && !levels.has(entry.level)) return false;
            return true;
        });
    }

    return {
        SCHOOL_ORDER,
        canonicalizeProfession,
        canonicalizeSchool,
        parseRawLevelEntries,
        getClassLevelEntries,
        normalizeSpellRecord,
        matchesCombinedFilter,
        matchingClassLevels,
        normalizeText
    };
});
