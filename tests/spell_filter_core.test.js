const assert = require('assert');
const Core = require('../web/assets/js/spell-filter-core.js');

const meta = Core.normalizeSpellRecord({
    spell_id: 'demo-001',
    name: '示例法术 (Demo Spell)',
    school: '塑能系 [火]',
    level_raw: '法师/术士 3，吟游诗人 4',
    source_book: 'TEST'
});

const f = (professions = [], levels = [], schools = []) => ({
    professions: new Set(professions),
    levels: new Set(levels),
    schools: new Set(schools),
    query: ''
});

assert.deepStrictEqual(meta.classLevels, [
    { profession: '法师', level: 3 },
    { profession: '术士', level: 3 },
    { profession: '吟游诗人', level: 4 }
]);

assert.equal(Core.matchesCombinedFilter(meta, f(['法师'], [3])), true, '法师 3环应命中');
assert.equal(Core.matchesCombinedFilter(meta, f(['术士'], [3])), true, '术士 3环应命中');
assert.equal(Core.matchesCombinedFilter(meta, f(['吟游诗人'], [4])), true, '吟游诗人 4环应命中');
assert.equal(Core.matchesCombinedFilter(meta, f(['吟游诗人'], [3])), false, '吟游诗人 3环不应命中');
assert.equal(Core.matchesCombinedFilter(meta, f(['法师'], [4])), false, '法师 4环不应命中');
assert.equal(Core.matchesCombinedFilter(meta, f(['法师', '吟游诗人'], [4])), true, '多职业多环位应由吟游诗人 4环配对命中');
assert.equal(Core.matchesCombinedFilter(meta, f(['法师'], [3], ['塑能'])), true, '职业、环位、学派组合应命中');
assert.equal(Core.matchesCombinedFilter(meta, f(['法师'], [3], ['防护'])), false, '学派不符时不应命中');

console.log('spell-filter-core: all tests passed');
