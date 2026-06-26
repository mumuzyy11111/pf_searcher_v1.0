document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const Core = window.PFSpellFilterCore;
    if (!Core) throw new Error('PFSpellFilterCore 未加载');

    const FALLBACK_SOURCES = [
        '/result/crb/spells-crb.json', '/result/acg/spells-acg.json', '/result/apg/spells-apg.json',
        '/result/arg/spells-arg.json', '/result/uc/spells-uc-model.json', '/result/um/spells-um-model.json',
        '/result/ui/spells-ui-model.json', '/result/oa/spells-oa.json', '/result/aarch/spells-aarch-model.json',
        '/result/cotr/spells-cotr-model.json', '/result/fob/spells-fob-model.json', '/result/foc/spells-foc-model.json',
        '/result/fop/spells-fop-model.json', '/result/isg/spells-isg-model.json', '/result/isi/spells-isi-model.json',
        '/result/ism/spells-ism-model.json', '/result/iswg/spells-iswg-model.json', '/result/mtt/spells-mtt-model.json',
        '/result/rtt/spells-rtt-model.json', '/result/tg/spells-tg-model.json', '/result/ag/spells-ag-model.json',
        '/result/mc/spells-mc-model.json', '/result/ma/spells-ma-model.json', '/result/vc/spells-vc-model.json',
        '/result/ha/spells-ha-model.json', '/result/uw/spells-uw-model.json', '/result/pa/spells-pa-model.json',
        '/result/botd/spells-botd-model.json'
    ];

    const $ = id => document.getElementById(id);
    const elements = {
        query: $('name-query'), open: $('open-filter'), close: $('close-filter'), modal: $('filter-modal'),
        apply: $('apply-filter'), resetDraft: $('reset-draft'), clearAll: $('clear-all'), badge: $('filter-count-badge'),
        activeChips: $('active-filter-chips'), professionOptions: $('profession-options'), schoolOptions: $('school-options'),
        levelOptions: $('level-options'), professionSearch: $('profession-search'), draftCount: $('draft-match-count'),
        summary: $('result-summary'), list: $('spell-list'), detail: $('detail-panel'), loadMore: $('load-more')
    };

    let allMetas = [];
    let filteredMetas = [];
    let visibleLimit = 150;
    let selectedId = null;
    let professionCounts = new Map();
    let schoolCounts = new Map();
    let levelCounts = new Map();

    const committed = { professions: new Set(), schools: new Set(), levels: new Set(), query: '' };
    let draft = cloneFilters(committed);

    function cloneFilters(filters) {
        return {
            professions: new Set(filters.professions),
            schools: new Set(filters.schools),
            levels: new Set(filters.levels),
            query: filters.query || ''
        };
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function field(raw, keys) {
        for (const key of keys) {
            const value = raw && raw[key];
            if (value === undefined || value === null || value === '') continue;
            return value;
        }
        return '';
    }

    async function resolveSources() {
        try {
            const response = await fetch('/api/spell-sources');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const paths = (Array.isArray(data.sources) ? data.sources : []).map(item => item.path).filter(Boolean);
            return paths.length ? paths : FALLBACK_SOURCES;
        } catch (error) {
            console.warn('无法读取动态数据源，使用内置清单：', error);
            return FALLBACK_SOURCES;
        }
    }

    async function loadSpellData() {
        const paths = await resolveSources();
        const settled = await Promise.allSettled(paths.map(async path => {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        }));

        const rawSpells = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
        const seen = new Set();
        allMetas = rawSpells
            .map((spell, index) => Core.normalizeSpellRecord(spell, index))
            .filter(Boolean)
            .filter(meta => {
                if (seen.has(meta.id)) return false;
                seen.add(meta.id);
                return true;
            });

        buildCounts();
        renderOptionGroups();
        applyCommittedFilters();
    }

    function buildCounts() {
        professionCounts = uniqueSpellCounts(meta => meta.classLevels.map(entry => entry.profession));
        schoolCounts = uniqueSpellCounts(meta => [meta.school]);
        levelCounts = uniqueSpellCounts(meta => meta.classLevels.map(entry => entry.level));
    }

    function uniqueSpellCounts(valueGetter) {
        const bucket = new Map();
        allMetas.forEach(meta => {
            new Set(valueGetter(meta)).forEach(value => {
                if (value === '' || value == null) return;
                if (!bucket.has(value)) bucket.set(value, new Set());
                bucket.get(value).add(meta.id);
            });
        });
        return new Map(Array.from(bucket, ([key, ids]) => [key, ids.size]));
    }

    function renderOptionGroups() {
        renderProfessionOptions();
        renderSchoolOptions();
        renderLevelOptions();
    }

    function createOptionButton(label, count, selected, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `option-btn${selected ? ' selected' : ''}`;
        button.innerHTML = `<span>${escapeHtml(label)}</span><span class="option-count">${count}</span>`;
        button.addEventListener('click', onClick);
        return button;
    }

    function renderProfessionOptions() {
        const needle = Core.normalizeText(elements.professionSearch.value);
        elements.professionOptions.innerHTML = '';
        Array.from(professionCounts.entries())
            .filter(([name]) => !needle || Core.normalizeText(name).includes(needle))
            .sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans'))
            .forEach(([name, count]) => {
                elements.professionOptions.appendChild(createOptionButton(name, count, draft.professions.has(name), () => {
                    toggleSetValue(draft.professions, name);
                    renderProfessionOptions();
                    updateDraftCount();
                }));
            });
    }

    function renderSchoolOptions() {
        elements.schoolOptions.innerHTML = '';
        Array.from(schoolCounts.entries())
            .sort((a, b) => {
                const ai = Core.SCHOOL_ORDER.indexOf(a[0]);
                const bi = Core.SCHOOL_ORDER.indexOf(b[0]);
                return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a[0].localeCompare(b[0], 'zh-Hans');
            })
            .forEach(([name, count]) => {
                elements.schoolOptions.appendChild(createOptionButton(name, count, draft.schools.has(name), () => {
                    toggleSetValue(draft.schools, name);
                    renderSchoolOptions();
                    updateDraftCount();
                }));
            });
    }

    function renderLevelOptions() {
        elements.levelOptions.innerHTML = '';
        for (let level = 0; level <= 9; level += 1) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `level-btn${draft.levels.has(level) ? ' selected' : ''}`;
            button.innerHTML = `${level}环<br><span class="option-count">${levelCounts.get(level) || 0}</span>`;
            button.addEventListener('click', () => {
                toggleSetValue(draft.levels, level);
                renderLevelOptions();
                updateDraftCount();
            });
            elements.levelOptions.appendChild(button);
        }
    }

    function toggleSetValue(set, value) {
        if (set.has(value)) set.delete(value);
        else set.add(value);
    }

    function countMatches(filters) {
        return allMetas.reduce((count, meta) => count + (Core.matchesCombinedFilter(meta, filters) ? 1 : 0), 0);
    }

    function updateDraftCount() {
        const count = countMatches({ ...draft, query: committed.query });
        elements.draftCount.textContent = `当前条件可显示 ${count} 个法术`;
        elements.apply.textContent = `显示 ${count} 个结果`;
    }

    function openModal(sectionId) {
        draft = cloneFilters(committed);
        elements.professionSearch.value = '';
        renderOptionGroups();
        updateDraftCount();
        elements.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (sectionId) requestAnimationFrame(() => $(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }

    function closeModal() {
        elements.modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    function applyDraft() {
        committed.professions = new Set(draft.professions);
        committed.schools = new Set(draft.schools);
        committed.levels = new Set(draft.levels);
        closeModal();
        applyCommittedFilters();
    }

    function clearCommittedFilters() {
        committed.professions.clear();
        committed.schools.clear();
        committed.levels.clear();
        elements.query.value = '';
        committed.query = '';
        applyCommittedFilters();
    }

    function activeFilterCount() {
        return committed.professions.size + committed.schools.size + committed.levels.size;
    }

    function renderActiveFilters() {
        elements.activeChips.innerHTML = '';
        const chips = [
            ...Array.from(committed.professions).map(value => ({ type: 'professions', value, label: `职业：${value}` })),
            ...Array.from(committed.schools).map(value => ({ type: 'schools', value, label: `学派：${value}` })),
            ...Array.from(committed.levels).sort((a, b) => a - b).map(value => ({ type: 'levels', value, label: `${value}环` }))
        ];
        chips.forEach(chip => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'active-chip';
            button.innerHTML = `${escapeHtml(chip.label)} <span class="x" aria-hidden="true">×</span>`;
            button.addEventListener('click', () => {
                committed[chip.type].delete(chip.value);
                applyCommittedFilters();
            });
            elements.activeChips.appendChild(button);
        });

        const count = activeFilterCount();
        elements.badge.textContent = String(count);
        elements.badge.classList.toggle('hidden', count === 0);
        elements.clearAll.classList.toggle('hidden', count === 0 && !committed.query);
    }

    function applyCommittedFilters() {
        visibleLimit = 150;
        filteredMetas = allMetas.filter(meta => Core.matchesCombinedFilter(meta, committed));
        filteredMetas.sort(compareMetas);
        if (!filteredMetas.some(meta => meta.id === selectedId)) selectedId = null;
        renderActiveFilters();
        renderResults();
    }

    function compareMetas(a, b) {
        const aLevels = Core.matchingClassLevels(a, committed);
        const bLevels = Core.matchingClassLevels(b, committed);
        const aMin = aLevels.length ? Math.min(...aLevels.map(item => item.level)) : 99;
        const bMin = bLevels.length ? Math.min(...bLevels.map(item => item.level)) : 99;
        return aMin - bMin || a.displayName.localeCompare(b.displayName, 'zh-Hans') || a.source.localeCompare(b.source);
    }

    function renderResults() {
        elements.summary.textContent = `显示 ${filteredMetas.length} / ${allMetas.length} 个法术`;
        elements.list.innerHTML = '';
        const visible = filteredMetas.slice(0, visibleLimit);
        if (!visible.length) {
            elements.list.innerHTML = '<div class="empty-results"><strong>没有符合条件的法术</strong><br>尝试减少职业、学派或环位条件。</div>';
            elements.loadMore.classList.add('hidden');
            renderDetail(null);
            return;
        }

        visible.forEach(meta => elements.list.appendChild(renderSpellRow(meta)));
        elements.loadMore.classList.toggle('hidden', visibleLimit >= filteredMetas.length);
        elements.loadMore.textContent = `加载更多（剩余 ${Math.max(0, filteredMetas.length - visibleLimit)}）`;
        renderDetail(selectedId ? allMetas.find(meta => meta.id === selectedId) : null);
    }

    function renderSpellRow(meta) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `spell-row${selectedId === meta.id ? ' active' : ''}`;
        const matchedPairs = Core.matchingClassLevels(meta, committed);
        const pairsToShow = (matchedPairs.length ? matchedPairs : meta.classLevels).slice(0, 4);
        const tags = [
            `<span class="meta-tag">${escapeHtml(meta.school)}</span>`,
            ...pairsToShow.map(entry => `<span class="meta-tag${matchedPairs.length ? ' match' : ''}">${escapeHtml(entry.profession)} ${entry.level}环</span>`)
        ];
        if ((matchedPairs.length ? matchedPairs : meta.classLevels).length > pairsToShow.length) {
            tags.push(`<span class="meta-tag">+${(matchedPairs.length ? matchedPairs : meta.classLevels).length - pairsToShow.length}</span>`);
        }
        button.innerHTML = `
            <span>
                <span class="spell-row-name">${escapeHtml(meta.name)}</span>
                <span class="spell-row-sub">${tags.join('')}</span>
            </span>
            <span class="spell-row-source">${escapeHtml(meta.source || '-')}</span>`;
        button.addEventListener('click', () => {
            selectedId = meta.id;
            elements.list.querySelectorAll('.spell-row').forEach(node => node.classList.remove('active'));
            button.classList.add('active');
            renderDetail(meta);
        });
        return button;
    }

    function renderDetail(meta) {
        if (!meta) {
            elements.detail.innerHTML = '<div class="detail-empty"><strong>选择一个法术</strong><span>点击左侧结果查看完整详情。</span></div>';
            return;
        }
        const raw = meta.raw;
        const lines = [
            ['学派', field(raw, ['学派', 'school']) || meta.school],
            ['施法时间', field(raw, ['施法时间', 'cast_time'])],
            ['成分', field(raw, ['成分', 'components'])],
            ['范围', field(raw, ['范围', 'range'])],
            ['区域', field(raw, ['区域', 'area'])],
            ['目标', field(raw, ['目标', 'target'])],
            ['持续时间', field(raw, ['持续', '持续时间', 'duration'])],
            ['豁免', field(raw, ['豁免', 'save'])],
            ['等级', field(raw, ['等级', 'level_raw'])],
            ['法术抗力', field(raw, ['法术抗力', 'spell_resistance'])],
            ['来源', meta.source],
            ['类型', field(raw, ['类型', 'type_label', '法术类型', 'spell_type'])]
        ].filter(([, value]) => value !== '' && value != null);
        const effect = field(raw, ['法术效果', '效果', 'effect']) || '无描述';
        elements.detail.innerHTML = `
            <article class="detail-card">
                <h2>${escapeHtml(meta.name)}</h2>
                <div class="detail-grid">
                    ${lines.map(([label, value]) => `<div class="detail-line"><span class="detail-label">${escapeHtml(label)}：</span>${escapeHtml(value)}</div>`).join('')}
                </div>
                <div class="detail-effect">${escapeHtml(effect)}</div>
            </article>`;
    }

    function debounce(fn, delay = 240) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    elements.open.addEventListener('click', () => openModal());
    elements.close.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', event => {
        if (event.target.dataset.closeModal === 'true') closeModal();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !elements.modal.classList.contains('hidden')) closeModal();
    });
    document.querySelectorAll('[data-focus-section]').forEach(button => {
        button.addEventListener('click', () => openModal(button.dataset.focusSection));
    });
    elements.apply.addEventListener('click', applyDraft);
    elements.resetDraft.addEventListener('click', () => {
        draft.professions.clear(); draft.schools.clear(); draft.levels.clear();
        renderOptionGroups(); updateDraftCount();
    });
    elements.clearAll.addEventListener('click', clearCommittedFilters);
    elements.professionSearch.addEventListener('input', renderProfessionOptions);
    elements.query.addEventListener('input', debounce(() => {
        committed.query = elements.query.value.trim();
        applyCommittedFilters();
    }));
    elements.loadMore.addEventListener('click', () => {
        visibleLimit += 150;
        renderResults();
    });

    loadSpellData().catch(error => {
        console.error('加载法术数据失败：', error);
        elements.summary.textContent = '加载法术数据失败。请确认后端服务已启动。';
        elements.list.innerHTML = `<div class="empty-results">${escapeHtml(error.message || error)}</div>`;
    });
});
