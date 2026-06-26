document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const modeSelect = document.getElementById('search-mode');
    const resultsContainer = document.getElementById('results-container');
    const spellCountDiv = document.getElementById('spell-count');
    const professionSelector = document.getElementById('profession-selector');
    const levelSelector = document.getElementById('level-selector');
    const nameSearchBox = document.getElementById('name-search-box');
    const ragPanel = document.getElementById('rag-panel');
    const ragInput = document.getElementById('rag-input');
    const ragApiKeyInput = document.getElementById('rag-api-key');
    const ragSubmit = document.getElementById('rag-submit');
    const ragAnswer = document.getElementById('rag-answer');
    const ragStatus = document.getElementById('rag-status');
    const modeHint = document.getElementById('mode-hint');
    const keywordSearchBtn = document.getElementById('keyword-search-btn');

    let allSpells = [];
    let spellsLoaded = false;
    let spellsLoadingPromise = null;
    const professionIndex = {};
    const professionNames = {};
    const schoolIndex = {};
    const schoolNames = {};
    let selectedProfession = null;
    let currentProfessionGroup = null;
    let selectedSchool = null;
    let currentSchoolGroup = null;
    let selectedLevel = null;
    const professionLevelByKey = {};
    let ragServiceOnline = false;
    let keywordSearchSeq = 0;
    let keywordLastTotal = 0;
    let keywordLastShown = 0;
    const DATA_SOURCES = [
        '../result/crb/spells-crb.json',
        '../result/acg/spells-acg.json',
        '../result/apg/spells-apg.json',
        '../result/arg/spells-arg.json',
        '../result/uc/spells-uc-model.json',
        '../result/um/spells-um-model.json',
        '../result/ui/spells-ui-model.json',
        '../result/oa/spells-oa.json',
        '../result/aarch/spells-aarch-model.json',
        '../result/cotr/spells-cotr-model.json',
        '../result/fob/spells-fob-model.json',
        '../result/foc/spells-foc-model.json',
        '../result/fop/spells-fop-model.json',
        '../result/isg/spells-isg-model.json',
        '../result/isi/spells-isi-model.json',
        '../result/ism/spells-ism-model.json',
        '../result/iswg/spells-iswg-model.json',
        '../result/mtt/spells-mtt-model.json',
        '../result/rtt/spells-rtt-model.json',
        '../result/tg/spells-tg-model.json',
        '../result/ag/spells-ag-model.json',
        '../result/mc/spells-mc-model.json',
        '../result/ma/spells-ma-model.json',
        '../result/vc/spells-vc-model.json',
        '../result/ha/spells-ha-model.json',
        '../result/uw/spells-uw-model.json',
        '../result/pa/spells-pa-model.json',
        '../result/botd/spells-botd-model.json',
    ];
    let dataSourceUrls = [...DATA_SOURCES];
    let spellSourcesLoadingPromise = null;

    const normalize = (text) => {
        if (!text) return '';
        return text.replace(/\s+/g, ' ').trim().toLowerCase();
    };

    const hasChinese = (text) => /[\u4e00-\u9fff]/.test(String(text || ''));

    const decodeLatin1ToUtf8 = (text) => {
        const bytes = Uint8Array.from(String(text || ''), ch => ch.charCodeAt(0) & 0xFF);
        return new TextDecoder('utf-8').decode(bytes);
    };

    const fixMojibake = (text) => {
        const raw = String(text || '');
        if (!raw || hasChinese(raw)) return raw;
        if (!/[^\x00-\x7F]/.test(raw)) return raw;
        try {
            const decoded = decodeLatin1ToUtf8(raw);
            if (hasChinese(decoded)) return decoded;
            return raw;
        } catch (_) {
            return raw;
        }
    };

    const normalizeSpellFields = (spell) => {
        const normalized = { ...(spell || {}) };
        Object.entries(spell || {}).forEach(([rawKey, rawValue]) => {
            const key = fixMojibake(rawKey);
            const value = typeof rawValue === 'string' ? fixMojibake(rawValue) : rawValue;
            if (
                !(key in normalized) ||
                normalized[key] === undefined ||
                normalized[key] === null ||
                normalized[key] === ''
            ) {
                normalized[key] = value;
            }
        });
        return normalized;
    };

    const pickSpellField = (spell, keys) => {
        for (const key of keys) {
            const value = spell && spell[key];
            if (value === undefined || value === null) continue;
            if (typeof value === 'string' && !value.trim()) continue;
            return value;
        }
        return '';
    };

    const deriveDisplayName = (spell) => {
        const directCandidates = [
            spell && spell['name_zh'],
            spell && spell['\u540d\u79f0'],
            spell && spell['\u4e2d\u6587\u540d'],
            spell && spell['\u8bd1\u540d'],
        ];
        for (const item of directCandidates) {
            const value = String(item || '').trim();
            if (value && hasChinese(value)) return value;
        }

        const rawName = String((spell && spell['name']) || '').trim();
        if (!rawName) return '';

        const bracketMatch = rawName.match(/^(.+?)\s*[（(][^）)]+[）)]\s*$/);
        if (bracketMatch && hasChinese(bracketMatch[1])) return bracketMatch[1].trim();

        if (hasChinese(rawName)) return rawName;
        return rawName;
    };

    const valueContainsQuery = (value, normalizedQuery, seen = new Set()) => {
        if (value === null || value === undefined) {
            return false;
        }
        const valueType = typeof value;
        if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
            return normalize(String(value)).includes(normalizedQuery);
        }
        if (Array.isArray(value)) {
            return value.some(item => valueContainsQuery(item, normalizedQuery, seen));
        }
        if (valueType === 'object') {
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return Object.values(value).some(item => valueContainsQuery(item, normalizedQuery, seen));
        }
        return false;
    };

    const spellMatchesKeyword = (spell, normalizedQuery) => {
        if (!normalizedQuery) return true;
        if (valueContainsQuery(spell, normalizedQuery, new Set())) {
            return true;
        }
        return normalize(JSON.stringify(spell || {})).includes(normalizedQuery);
    };

    const sourceCodeFromPath = (path) => {
        const match = String(path || '').match(/(?:^|\/)result\/([^/]+)\//);
        return match ? match[1].toUpperCase() : '';
    };

    const sourceOptionFromInput = (source) => {
        if (typeof source === 'string') {
            const value = sourceCodeFromPath(source);
            return value ? { value, label: value } : null;
        }

        const value = String(source.source || '').toUpperCase();
        if (!value) return null;

        const display = source.display_source || value;
        const title = source.title ? ` - ${source.title}` : '';
        const internalCode = display !== value ? ` (${value})` : '';
        const aonCount = Number.isInteger(source.aon_count) ? source.aon_count : null;
        const indexedCount = Number.isInteger(source.indexed_count) ? source.indexed_count : null;
        const count = aonCount !== null && indexedCount !== null
            ? ` [${indexedCount}/${aonCount}]`
            : '';

        return {
            value,
            label: `${display}${internalCode}${title}${count}`,
        };
    };

    const populateRagSourceFilter = (sources) => {
        const sourceFilter = document.getElementById('rag-source-filter');
        if (!sourceFilter) return;

        const currentValue = sourceFilter.value;
        const optionsByValue = new Map();
        sources
            .map(sourceOptionFromInput)
            .filter(Boolean)
            .forEach(option => {
                optionsByValue.set(option.value, option);
            });
        const sourceOptions = Array.from(optionsByValue.values())
            .sort((a, b) => a.value.localeCompare(b.value));

        sourceFilter.innerHTML = '<option value="">全部来源</option>';
        sourceOptions.forEach(source => {
            const option = document.createElement('option');
            option.value = source.value;
            option.textContent = source.label;
            sourceFilter.appendChild(option);
        });

        if (optionsByValue.has(currentValue)) {
            sourceFilter.value = currentValue;
        }
    };

    const ensureSpellSourcesLoaded = () => {
        if (spellSourcesLoadingPromise) {
            return spellSourcesLoadingPromise;
        }

        spellSourcesLoadingPromise = fetch('/api/spell-sources')
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                const sources = Array.isArray(data.sources) ? data.sources : [];
                const paths = sources
                    .map(source => source.path)
                    .filter(Boolean);
                if (paths.length) {
                    dataSourceUrls = paths;
                    populateRagSourceFilter(sources);
                } else {
                    populateRagSourceFilter(DATA_SOURCES);
                }
            })
            .catch(error => {
                dataSourceUrls = [...DATA_SOURCES];
                populateRagSourceFilter(DATA_SOURCES);
                console.warn('使用内置法术数据源列表:', error);
            })
            .finally(() => {
                spellSourcesLoadingPromise = null;
            });

        return spellSourcesLoadingPromise;
    };

    const debounce = (fn, delay = 300) => {
        let timer = null;
        return (...args) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    };

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const renderInlineMarkdown = (value) => escapeHtml(value)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');

    const renderMarkdown = (markdown) => {
        const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
        const html = [];
        let i = 0;

        const isTableSeparator = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
        const splitTableRow = (line) => line
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map(cell => cell.trim());

        while (i < lines.length) {
            const line = lines[i];
            if (!line.trim()) {
                i += 1;
                continue;
            }

            if (line.includes('|') && lines[i + 1] && isTableSeparator(lines[i + 1])) {
                const headers = splitTableRow(line);
                const rows = [];
                i += 2;
                while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
                    rows.push(splitTableRow(lines[i]));
                    i += 1;
                }
                html.push('<div class="rag-table-wrap"><table class="rag-table"><thead><tr>');
                headers.forEach(header => html.push(`<th>${renderInlineMarkdown(header)}</th>`));
                html.push('</tr></thead><tbody>');
                rows.forEach(row => {
                    html.push('<tr>');
                    headers.forEach((_, index) => {
                        html.push(`<td>${renderInlineMarkdown(row[index] || '')}</td>`);
                    });
                    html.push('</tr>');
                });
                html.push('</tbody></table></div>');
                continue;
            }

            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            if (heading) {
                const level = heading[1].length + 2;
                html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
                i += 1;
                continue;
            }

            const listItems = [];
            while (i < lines.length) {
                const item = lines[i].match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
                if (!item) break;
                listItems.push(item[1]);
                i += 1;
            }
            if (listItems.length) {
                html.push('<ul>');
                listItems.forEach(item => html.push(`<li>${renderInlineMarkdown(item)}</li>`));
                html.push('</ul>');
                continue;
            }

            const paragraph = [];
            while (
                i < lines.length &&
                lines[i].trim() &&
                !(lines[i].includes('|') && lines[i + 1] && isTableSeparator(lines[i + 1])) &&
                !/^\s*(?:[-*]|\d+\.)\s+/.test(lines[i]) &&
                !/^(#{1,3})\s+/.test(lines[i])
            ) {
                paragraph.push(lines[i].trim());
                i += 1;
            }
            html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
        }

        return html.join('');
    };

    const parseProfessionEntries = (levelText) => {
        if (!levelText) return [];
        const recoveredText = fixMojibake(levelText);
        return recoveredText
            .replace(/\n/g, ' ')
            .replace(/[\uFF0F]/g, '/')
            .replace(/([0-9])(?=[\u4e00-\u9fff])/g, '$1 ')
            .split(/[\uFF0C,\u3001,\uFF1B,;]/)
            .map(token => token.trim())
            .filter(Boolean)
            .flatMap(part => {
                const match = part.match(/^(.+?)\s*([0-9])(?:\s|$)/);
                if (!match) {
                    return [];
                }
                const level = Number(match[2]);
                const professionText = match[1]
                    .replace(/[()\uFF08\uFF09]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (!professionText) {
                    return [];
                }

                return professionText
                    .split('/')
                    .map(item => fixMojibake(item).trim())
                    .filter(Boolean)
                    .filter(name => !name.includes('\u9886\u57DF') && !name.includes('\u5B50\u57DF'))
                    .map(profession => ({ profession, level }));
            });
    };

    const splitSpellResistance = (text) => {
        const value = (text || '').replace(/\s+/g, ' ').trim();
        if (!value) return { spellResistance: '', effectRemainder: '' };
        const match = value.match(/^((?:可|否|无|有|见下文|见后文)(?:\s*[,，;；]\s*见[下后]文)?(?:\s*[（(][^）)]{1,30}[）)])?(?:和(?:可|否|无|有)[（(][^）)]{1,30}[）)])?)\s+(.+)$/);
        if (
            !match ||
            (match[2].trim().startsWith('(') && match[2].trim().endsWith(')')) ||
            (match[2].trim().startsWith('（') && match[2].trim().endsWith('）')) ||
            match[2].length < 8
        ) {
            return { spellResistance: value, effectRemainder: '' };
        }
        return {
            spellResistance: match[1].trim(),
            effectRemainder: match[2].trim()
        };
    };

    const looksLikeLevelText = (text) => {
        const value = (text || '').replace(/\s+/g, ' ').trim();
        if (!value) return false;
        if (/[防护咒法预言惑控塑能幻术死灵变化变形通用]/.test(value) || /abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation|universal/i.test(value)) {
            return false;
        }
        return parseProfessionEntries(value).length > 0;
    };

    const SCHOOL_TRANSLATIONS = {
        abjuration: '防护系',
        conjuration: '咒法系',
        divination: '预言系',
        enchantment: '惑控系',
        evocation: '塑能系',
        illusion: '幻术系',
        necromancy: '死灵系',
        transmutation: '变化系',
        universal: '通用系'
    };

    const splitSchoolText = (text) => {
        const value = (text || '').replace(/\s+/g, ' ').trim();
        if (!value) return { value: '', levelRemainder: '' };
        const translated = SCHOOL_TRANSLATIONS[value.toLowerCase()];
        if (translated) return { value: translated, levelRemainder: '' };
        if (looksLikeLevelText(value)) {
            return { value: '', levelRemainder: value };
        }
        const schoolPrefix = value.match(/^(防护系|咒法系|预言系|惑控系|塑能系|幻术系|死灵系|变化系|变形系|通用系)(?:\s*[(（][^)）]{1,20}[)）])?(?:\s*\[[^\]]{1,80}\])?/);
        if (schoolPrefix) {
            const school = schoolPrefix[0].trim();
            const remainder = value.slice(schoolPrefix[0].length).trim();
            const hasFieldMarker = /^(学派|环位|等级|施法时间|成分|范围|目标|区域|持续时间|持续|豁免|法术抗力)(?:\s|$)/.test(remainder);
            const hasProse = /^(你|目标|生物|法术|该法术|当|如果|吟诵|祷言)/.test(remainder);
            if (remainder && (remainder.length > 20 || hasFieldMarker || hasProse)) {
                return { value: school, levelRemainder: remainder };
            }
        }
        return { value, levelRemainder: '' };
    };

    const splitAtProseMarker = (text, markers) => {
        const positions = markers
            .map(marker => text.indexOf(marker))
            .filter(pos => pos > 0);
        if (!positions.length) return { value: text, remainder: '' };
        const pos = Math.min(...positions);
        const value = text.slice(0, pos).trim();
        const remainder = text.slice(pos).trim();
        if (!value || remainder.length < 20) return { value: text, remainder: '' };
        return { value, remainder };
    };

    const isPlausibleLevelEntry = (entry) => {
        const text = (entry || '').replace(/\s+/g, ' ').trim();
        const className = text.replace(/\s*[0-9]\s*$/, '').trim();
        if (!className || className.length > 40) return false;
        if (/[。！？：:]/.test(className)) return false;
        return ![
            '该法术',
            '此法术',
            '这个法术',
            '该能力',
            '不过',
            '但是',
            '如果',
            '若',
            '当你',
            '目标',
            '受术者',
            '你可以',
            '你能够',
            '获得',
            '拥有',
            '提高',
            '造成',
            '每施法者',
            '施法者等级',
            '可创造',
            '类似于',
            '功能',
            '方式如同',
        ].some(marker => className.includes(marker));
    };

    const splitLevelText = (text) => {
        let pos = 0;
        let lastEnd = 0;
        const entries = [];
        const entryRe = /\s*(?:[,，、;；]\s*)?((?:领域\s+)?[^,，、;；0-9]{1,30}?\s*[0-9])/y;
        while (pos < text.length) {
            entryRe.lastIndex = pos;
            const match = entryRe.exec(text);
            if (!match) break;
            if (!isPlausibleLevelEntry(match[1])) break;
            entries.push(match[1].replace(/\s+/g, ' ').trim());
            lastEnd = entryRe.lastIndex;
            pos = entryRe.lastIndex;
        }
        if (!lastEnd) return { value: text, remainder: '' };
        const value = entries.join('，').replace(/^[,，、;；\s]+|[,，、;；\s]+$/g, '');
        const remainder = text.slice(lastEnd).trim();
        if (remainder.length < 20) return { value: text, remainder: '' };
        return { value, remainder };
    };

    const splitDurationPrefix = (text) => {
        const match = text.match(/^((?:\d+d?\d*(?:[+x×]\d+)?|\d+)[^ ]{0,30}(?:\s*[（(][^）)]{1,30}[）)])?(?:\s*或\s*[^ ]{1,30}(?:\s*[（(][^）)]{1,30}[）)])?)?)\s+(.+)$/);
        if (!match || match[2].length < 20) {
            return { value: text, remainder: '' };
        }
        return { value: match[1].trim(), remainder: match[2].trim() };
    };

    const splitPollutedField = (field, text) => {
        const value = (text || '').replace(/\s+/g, ' ').trim();
        if (!value) return { value: '', remainder: '' };

        if (field === 'spellResistance') {
            const result = splitSpellResistance(value);
            return { value: result.spellResistance, remainder: result.effectRemainder };
        }
        if (field === 'school') {
            const result = splitSchoolText(value);
            return { value: result.value, remainder: result.levelRemainder };
        }
        if (field === 'level') {
            return splitLevelText(value);
        }
        if (field === 'duration') {
            const durationSplit = splitDurationPrefix(value);
            if (durationSplit.remainder) return durationSplit;
            const split = splitAtProseMarker(value, [' 当你', ' 你', ' 若', ' 如果', ' 该法术', ' 此法术', ' 这个法术', ' 树木种类']);
            if (split.remainder) return split;
            const durationNotePos = value.indexOf(' 你无法');
            if (durationNotePos > 0) {
                return {
                    value: value.slice(0, durationNotePos).trim(),
                    remainder: value.slice(durationNotePos).trim()
                };
            }
            if (value.length > 120 && !/^(?:\d|1d|专注|立即|永久|瞬时|见|特殊|每|直至|直到)/.test(value)) {
                return { value: '', remainder: value };
            }
            return { value, remainder: '' };
        }
        if (field === 'target') {
            if (
                value.includes('(Targeted Dispel)') ||
                value.startsWith('获得DR') ||
                value.startsWith('受到每') ||
                value.startsWith('火器会') ||
                value.startsWith('武器持有者')
            ) {
                return { value: '', remainder: value };
            }
            const split = splitAtProseMarker(value, [' 该法术', ' 此法术', ' 这个法术', ' 当你', ' 如果', ' 若', ' 成功的', ' 通过', ' 除了']);
            if (split.remainder) {
                if (split.value.length > 220) return { value: '', remainder: value };
                return split;
            }
            if (value.length > 220) return { value: '', remainder: value };
            return { value, remainder: '' };
        }
        if (field === 'range') {
            if (value.includes('(Area Dispel)') || value.startsWith('型解除')) {
                return { value: '', remainder: value };
            }
            const split = splitAtProseMarker(value, [' 该法术', ' 此法术', ' 这个法术', ' 当你', ' 如果', ' 若', ' 一旦', ' 除了']);
            if (split.remainder) return split;
            if (value.length > 120) return { value: '', remainder: value };
            return { value, remainder: '' };
        }
        if (field === 'save') {
            const split = splitAtProseMarker(value, [' 此法术', ' 该法术', ' 这个法术', ' 当你', ' 如果', ' 若', ' 被射线']);
            if (split.remainder) return split;
            if (value.length > 200) return { value: '', remainder: value };
            return { value, remainder: '' };
        }
        if (field === 'components') {
            const split = splitAtProseMarker(value, [' 此法术', ' 该法术', ' 这个法术', ' 法术完成后', ' 当你', ' 如果', ' 若']);
            if (split.remainder) return split;
        }
        return { value, remainder: '' };
    };

    const LEVEL_OVERRIDES = [
        {
            nameIncludes: ['Wall ofEctoplasm', 'Wall of Ectoplasm'],
            level: '牧师 5，异能者 5，术士/法师 5，唤魂师 5'
        }
    ];

    const applyLevelOverride = (name, levelText) => {
        const override = LEVEL_OVERRIDES.find(item =>
            item.nameIncludes.some(token => (name || '').includes(token))
        );
        return override ? override.level : levelText;
    };

    const recoverLevelFromEffect = (levelText, effectText) => {
        const level = (levelText || '').replace(/\s+/g, ' ').trim();
        const effect = (effectText || '').replace(/\s+/g, ' ').trim();
        if (!level || !effect || parseProfessionEntries(level).length) {
            return { level, effect };
        }

        const lead = effect.match(/^(\d)(?:\s*[，,、]\s*|\s+)(.+)$/);
        if (!lead) return { level, effect };

        const recovered = [`${level} ${lead[1]}`];
        const rest = lead[2].trim();
        const entryRe = /\s*(?:[，,、]\s*)?([^，,、。；;0-9]{1,20}?)\s*(\d)(?=\s*[，,、]|[。；;]|\s|$)/y;
        let lastEnd = 0;
        let match = null;
        let pos = 0;
        while (pos < rest.length) {
            entryRe.lastIndex = pos;
            match = entryRe.exec(rest);
            if (!match) break;
            const className = match[1].replace(/\s+/g, ' ').trim();
            if (!className || className.length > 20) break;
            recovered.push(`${className} ${match[2]}`);
            lastEnd = entryRe.lastIndex;
            pos = entryRe.lastIndex;
        }

        const remainder = rest.slice(lastEnd).replace(/^[\s，,、；;]+/, '').trim();
        if (remainder.length < 10) return { level, effect };
        return { level: recovered.join('，'), effect: remainder };
    };

    const normalizeSpell = (spell) => {
        // 兼容两套数据结构：
        // 1) 老结构（中文字段）：学派/等级/法术效果/来源
        // 2) 模型结构（英文字段）：school/level_raw/effect/source_book
        if (!spell || typeof spell !== 'object') return null;
        const normalizedSpell = normalizeSpellFields(spell);
        const name = String(pickSpellField(normalizedSpell, ['name', '名称', '中文名', '译名']) || '');
        if (!name) return null;
        const rawEffect = pickSpellField(normalizedSpell, ['法术效果', '效果', 'effect']) || '';
        const school = splitPollutedField('school', pickSpellField(normalizedSpell, ['学派', 'school']) || '');
        const levelSource = [
            pickSpellField(normalizedSpell, ['等级', 'level_raw', '等級']) || '',
            school.remainder
        ].map(part => (part || '').trim()).filter(Boolean).join('，');
        const level = splitPollutedField(
            'level',
            applyLevelOverride(name, levelSource)
        );
        const components = splitPollutedField('components', pickSpellField(normalizedSpell, ['成分', 'components']) || '');
        const spellRange = splitPollutedField('range', pickSpellField(normalizedSpell, ['范围', 'range']) || '');
        const area = splitPollutedField('target', pickSpellField(normalizedSpell, ['区域', 'area']) || '');
        const target = splitPollutedField('target', pickSpellField(normalizedSpell, ['目标', 'target']) || '');
        const duration = splitPollutedField('duration', pickSpellField(normalizedSpell, ['持续', 'duration']) || '');
        const save = splitPollutedField('save', pickSpellField(normalizedSpell, ['豁免', 'save']) || '');
        const spellResistance = splitPollutedField('spellResistance', pickSpellField(normalizedSpell, ['法术抗力', 'spell_resistance']) || '');
        const source = String(pickSpellField(normalizedSpell, ['来源', 'source_book']) || '').toUpperCase();
        const spellType = pickSpellField(normalizedSpell, ['spell_type', '法术类型']) || (source === 'MA' ? 'mythic' : 'normal');
        const typeLabel = pickSpellField(normalizedSpell, ['type_label', '类型']) || (spellType === 'mythic' ? '神话法术' : '普通法术');
        const recovered = recoverLevelFromEffect(level.value, rawEffect);
        const mergedEffect = [
            recovered.effect,
            level.remainder,
            components.remainder,
            spellRange.remainder,
            area.remainder,
            target.remainder,
            duration.remainder,
            save.remainder,
            spellResistance.remainder
        ].map(part => (part || '').trim()).filter(Boolean).join('\n');
        return {
            ...normalizedSpell,
            name,
            display_name: deriveDisplayName(normalizedSpell),
            学派: school.value,
            施法时间: pickSpellField(normalizedSpell, ['施法时间', 'cast_time']) || '',
            成分: components.value,
            范围: spellRange.value,
            区域: area.value,
            目标: target.value,
            持续: duration.value,
            豁免: save.value,
            等级: recovered.level,
            法术抗力: spellResistance.value,
            来源: source,
            法术类型: spellType,
            类型: typeLabel,
            法术效果: mergedEffect,
        };
    };

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

    const KNOWN_PROFESSIONS = new Set([
        ...Object.values(PROFESSION_CANON),
        ...Object.values(PROFESSION_EN_TO_ZH),
    ]);

    // UI alias merge: ???=???, ???=???
    const PROFESSION_ALIAS_CANON = {
        '\u5723\u6b66\u58eb': '\u5723\u9a91\u58eb',
        '\u5723\u9a91\u58eb': '\u5723\u9a91\u58eb',
        '\u901a\u7075\u5e08': '\u901a\u7075\u8005',
        '\u901a\u7075\u8005': '\u901a\u7075\u8005',
    };

    const canonicalizeProfession = (name) => {
        if (!name) return '';
        let cleaned = name
            .replace(/[／]/g, '/')
            .replace(/\s*\/\s*/g, '/')
            .replace(/\s+/g, ' ')
            .trim();
        if (!cleaned) return '';

        const lower = cleaned.toLowerCase();
        const zhName = PROFESSION_EN_TO_ZH[lower] || cleaned;
        const merged = PROFESSION_ALIAS_CANON[zhName] || zhName;
        return PROFESSION_CANON[merged] || merged;
    };

    const isKnownProfession = (name) => KNOWN_PROFESSIONS.has(canonicalizeProfession(name));

    const SCHOOL_CANON = {
        '防护': '防护',
        '防护系': '防护',
        '咒法': '咒法',
        '咒法系': '咒法',
        '召唤': '咒法',
        '预言': '预言',
        '预言系': '预言',
        '惑控': '惑控',
        '惑控系': '惑控',
        '附魔': '惑控',
        '塑能': '塑能',
        '塑能系': '塑能',
        '幻术': '幻术',
        '幻术系': '幻术',
        '死灵': '死灵',
        '死灵系': '死灵',
        '变化': '变化',
        '变化系': '变化',
        '变形': '变化',
        '通用': '通用',
        '通用系': '通用',
        '神话': '神话法术',
        '神话法术': '神话法术',
    };

    const SCHOOL_ORDER = ['防护', '咒法', '预言', '惑控', '塑能', '幻术', '死灵', '变化', '神话法术', '通用', '其他'];

    const isMythicSpell = (spell) => {
        const spellType = String(spell.法术类型 || spell.spell_type || '').toLowerCase();
        const typeLabel = String(spell.类型 || spell.type_label || '');
        const source = String(spell.来源 || spell.source_book || '').toUpperCase();
        return spellType === 'mythic' || source === 'MA' || typeLabel.includes('神话');
    };

    const canonicalizeSchool = (schoolText) => {
        const raw = String(schoolText || '').replace(/\[[^\]]*]/g, '').replace(/【[^】]*】/g, '').trim();
        if (!raw) return '其他';
        const directMatch = ['防护', '咒法', '预言', '惑控', '附魔', '塑能', '幻术', '死灵', '变化', '变形', '神话法术', '神话', '通用']
            .find(name => raw.includes(name));
        if (directMatch) {
            return SCHOOL_CANON[directMatch] || directMatch;
        }
        const first = raw.split(/[，,；;\s]/).filter(Boolean)[0] || raw;
        const normalized = first.replace(/（.*?）|\(.*?\)/g, '').trim();
        return SCHOOL_CANON[normalized] || SCHOOL_CANON[normalized.replace(/系$/, '')] || normalized.replace(/系$/, '') || '其他';
    };

    const buildProfessionIndex = (spells) => {
        Object.keys(professionIndex).forEach(k => delete professionIndex[k]);
        Object.keys(professionNames).forEach(k => delete professionNames[k]);

        const pushEntry = (profession, level, spell) => {
            const canonical = canonicalizeProfession(profession);
            if (!isKnownProfession(canonical)) return;
            const key = normalize(canonical);
            if (!key) return;
            if (!professionIndex[key]) {
                professionIndex[key] = [];
            }
            professionIndex[key].push({ spell, level: Number(level) });
            professionNames[key] = professionNames[key] || canonical;
        };

        spells.forEach(spell => {
            const levelText = spell.等级 || spell.level_raw || spell['等級'] || '';
            const entries = parseProfessionEntries(levelText);
            entries.forEach(entry => pushEntry(entry.profession, entry.level, spell));

            const classLevels = spell.class_levels || spell['class_levels'] || [];
            if (Array.isArray(classLevels)) {
                classLevels.forEach(item => {
                    const cls = item && (item.class || item['class']);
                    const lvl = item && (item.level || item['level']);
                    if (!cls || lvl === undefined || lvl === null) return;
                    const num = Number(lvl);
                    if (!Number.isFinite(num)) return;
                    pushEntry(cls, num, spell);
                });
            }
        });
    };

    const buildSchoolIndex = (spells) => {
        Object.keys(schoolIndex).forEach(k => delete schoolIndex[k]);
        Object.keys(schoolNames).forEach(k => delete schoolNames[k]);

        spells.forEach(spell => {
            const school = isMythicSpell(spell)
                ? '神话法术'
                : canonicalizeSchool(spell.学派 || spell.school || '');
            const key = normalize(school);
            if (!key) return;
            if (!schoolIndex[key]) {
                schoolIndex[key] = [];
            }
            schoolIndex[key].push(spell);
            schoolNames[key] = schoolNames[key] || school;
        });

        Object.keys(schoolIndex).forEach(key => {
            schoolIndex[key].sort((a, b) => getSpellSortName(a).localeCompare(getSpellSortName(b), 'zh-Hans'));
        });
    };

    const getSpellSortName = (spell) => normalize(spell.display_name || spell.name || '');

    const getProfessionEntryKey = (entry) => {
        const spell = entry.spell || {};
        return spell.spell_id || `${spell.source_book || spell.来源 || ''}:${spell.name || spell.display_name || ''}`;
    };

    const dedupeProfessionEntries = (entries) => {
        const seen = new Set();
        return entries
            .filter(entry => {
                const key = `${entry.level}:${getProfessionEntryKey(entry)}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => a.level - b.level || getSpellSortName(a.spell).localeCompare(getSpellSortName(b.spell), 'zh-Hans'));
    };

    const getProfessionLevelGroups = (group) => {
        const groups = new Map();
        dedupeProfessionEntries(group.spells).forEach(entry => {
            if (!groups.has(entry.level)) {
                groups.set(entry.level, []);
            }
            groups.get(entry.level).push(entry);
        });
        return Array.from(groups.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([level, spells]) => ({ level, spells }));
    };

    const getProfessionLevelCounts = (group) => {
        return getProfessionLevelGroups(group).map(item => ({
            level: item.level,
            count: item.spells.length,
        }));
    };

    const dedupeSpells = (spells) => {
        const seen = new Set();
        return spells
            .filter(spell => {
                const key = spell.spell_id || `${spell.source_book || spell.来源 || ''}:${spell.name || spell.display_name || ''}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => getSpellSortName(a).localeCompare(getSpellSortName(b), 'zh-Hans'));
    };

    const renderField = (label, value) => {
        if (!value) return '';
        return `<div class="spell-detail"><span class="label">${label}：</span>${value}</div>`;
    };

    const renderSpellCard = (spell) => {
        const card = document.createElement('div');
        card.className = 'spell-card';
        card.innerHTML = `
            <div class="spell-name">${spell.name || '（未命名）'}</div>
            ${renderField('学派', spell.学派)}
            ${renderField('施法时间', spell.施法时间)}
            ${renderField('成分', spell.成分)}
            ${renderField('范围', spell.范围)}
            ${renderField('区域', spell.区域)}
            ${renderField('目标', spell.目标)}
            ${renderField('持续', spell.持续)}
            ${renderField('豁免', spell.豁免)}
            ${renderField('等级', spell.等级)}
            ${renderField('法术抗力', spell.法术抗力)}
            ${renderField('来源', spell.来源)}
            ${renderField('类型', spell.类型)}
            <div class="spell-effect">${spell.法术效果 || '无描述'}</div>
        `;
        return card;
    };

    const findSpellForCitation = (citation) => {
        const citationName = normalize(citation.name || '');
        const source = normalize(citation.source || '');
        return allSpells.find(spell => spell.spell_id && spell.spell_id === citation.spell_id)
            || allSpells.find(spell =>
                (normalize(spell.name) === citationName || normalize(spell.display_name) === citationName) &&
                (!source || normalize(spell.来源) === source || normalize(spell.source_book) === source)
            )
            || allSpells.find(spell => citationName && (normalize(spell.name).includes(citationName.replace(/\s+/g, ' ')) || normalize(spell.display_name).includes(citationName.replace(/\s+/g, ' '))));
    };

    const showCitationSpell = async (citation, detailContainer, activeButton) => {
        detailContainer.textContent = '正在加载法术详情...';
        try {
            await ensureSpellDataLoaded();
            const spell = findSpellForCitation(citation);
            detailContainer.innerHTML = '';
            if (!spell) {
                detailContainer.textContent = `未找到法术详情：${citation.name}`;
                return;
            }
            if (activeButton) {
                activeButton.parentElement.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                activeButton.classList.add('active');
            }
            detailContainer.appendChild(renderSpellCard(spell));
        } catch (error) {
            detailContainer.textContent = '加载法术详情失败。';
            console.error('加载引用法术失败:', error);
        }
    };

    const renderRagAnswer = (data) => {
        ragAnswer.innerHTML = '';

        const answerBody = document.createElement('div');
        answerBody.className = 'rag-markdown';
        answerBody.innerHTML = renderMarkdown(data.answer || '');
        ragAnswer.appendChild(answerBody);

        const citations = Array.isArray(data.citations) ? data.citations : [];
        if (citations.length) {
            const citationPanel = document.createElement('div');
            citationPanel.className = 'rag-citations';

            const title = document.createElement('div');
            title.className = 'rag-citations-title';
            title.textContent = '引用法术索引';
            citationPanel.appendChild(title);

            const buttons = document.createElement('div');
            buttons.className = 'rag-citation-buttons';
            citationPanel.appendChild(buttons);

            const detailContainer = document.createElement('div');
            detailContainer.className = 'rag-citation-detail';
            citationPanel.appendChild(detailContainer);

            citations.forEach((citation, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = `[${index + 1}] ${citation.name} (${citation.source})`;
                button.addEventListener('click', () => showCitationSpell(citation, detailContainer, button));
                buttons.appendChild(button);
            });

            ragAnswer.appendChild(citationPanel);
        }

        ragAnswer.classList.remove('hidden');
    };

    const displayNameResults = (spells) => {
        resultsContainer.innerHTML = '';
        if (!spells.length) {
            resultsContainer.textContent = '未找到匹配的法术。';
            return;
        }
        spells.forEach(spell => resultsContainer.appendChild(renderSpellCard(spell)));
    };

    const runKeywordSearch = async () => {
        const query = searchInput.value.trim();
        const normalizedQuery = normalize(query);

        if (!normalizedQuery) {
            await ensureSpellDataLoaded();
            displayNameResults(allSpells);
            updateCountText('keyword');
            return;
        }

        const currentSeq = ++keywordSearchSeq;
        resultsContainer.textContent = '关键词搜索中，请稍候...';
        spellCountDiv.textContent = '正在执行关键词搜索...';

        try {
            const response = await fetch(`/api/spells/keyword?q=${encodeURIComponent(query)}&limit=5000`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            if (currentSeq !== keywordSearchSeq) {
                return;
            }

            const hits = Array.isArray(data.hits) ? data.hits : [];
            const normalizedHits = hits
                .map(normalizeSpell)
                .filter(Boolean);

            displayNameResults(normalizedHits);
            spellCountDiv.textContent = `关键词“${query}”命中 ${data.total || normalizedHits.length} 个法术，当前展示 ${normalizedHits.length} 个`;
        } catch (error) {
            if (currentSeq !== keywordSearchSeq) {
                return;
            }
            console.warn('关键词接口不可用，回退到本地搜索:', error);
            await ensureSpellDataLoaded();
            const fallbackSpells = allSpells.filter(spell => spellMatchesKeyword(spell, normalizedQuery));
            displayNameResults(fallbackSpells);
            updateCountText('keyword');
        }
    };

    const getSpellLevelSummary = (spell) => {
        const levelText = (spell.等级 || spell.level_raw || '').toString().trim();
        return levelText || '-';
    };

    const displayKeywordTableResults = (spells) => {
        resultsContainer.innerHTML = '';
        if (!spells.length) {
            resultsContainer.textContent = '未找到匹配的法术。';
            return;
        }

        const layout = document.createElement('div');
        layout.className = 'keyword-results-layout';

        const tableWrap = document.createElement('div');
        tableWrap.className = 'keyword-table-wrap keyword-results-list';

        const table = document.createElement('table');
        table.className = 'keyword-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>索引</th>
                    <th>法术名称</th>
                    <th>职业等级</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');
        const detailContainer = document.createElement('div');
        detailContainer.className = 'keyword-detail-panel';
        detailContainer.innerHTML = '<div class="keyword-detail-empty">点击左侧索引查看法术详述。</div>';

        spells.forEach((spell, idx) => {
            const tr = document.createElement('tr');
            tr.className = 'keyword-result-row';
            const idxTd = document.createElement('td');
            const nameTd = document.createElement('td');
            const levelTd = document.createElement('td');

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'keyword-index-btn';
            btn.textContent = String(idx + 1);
            btn.addEventListener('click', () => {
                tbody.querySelectorAll('.keyword-index-btn').forEach(node => node.classList.remove('active'));
                tbody.querySelectorAll('.keyword-result-row').forEach(node => node.classList.remove('active'));
                btn.classList.add('active');
                tr.classList.add('active');
                detailContainer.innerHTML = '';
                detailContainer.appendChild(renderSpellCard(spell));
            });

            idxTd.appendChild(btn);
            nameTd.textContent = spell.name || '（未命名）';
            levelTd.textContent = getSpellLevelSummary(spell);
            tr.appendChild(idxTd);
            tr.appendChild(nameTd);
            tr.appendChild(levelTd);
            tbody.appendChild(tr);
        });

        tableWrap.appendChild(table);
        layout.appendChild(tableWrap);
        layout.appendChild(detailContainer);
        resultsContainer.appendChild(layout);
    };

    const runKeywordSearchByButton = async () => {
        const query = searchInput.value.trim();
        const normalizedQuery = normalize(query);

        if (!normalizedQuery) {
            keywordLastTotal = 0;
            keywordLastShown = 0;
            spellCountDiv.textContent = '请输入关键词后点击搜索';
            resultsContainer.textContent = '请输入关键词后点击“搜索”。';
            return;
        }

        const currentSeq = ++keywordSearchSeq;
        spellCountDiv.textContent = '正在执行关键词搜索...';
        resultsContainer.textContent = '关键词搜索中，请稍候...';

        try {
            const response = await fetch(`/api/spells/keyword?q=${encodeURIComponent(query)}&limit=5000`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            if (currentSeq !== keywordSearchSeq) return;

            const hits = Array.isArray(data.hits) ? data.hits : [];
            const normalizedHits = hits.map(normalizeSpell).filter(Boolean);
            displayKeywordTableResults(normalizedHits);
            keywordLastTotal = Number.isFinite(data.total) ? data.total : normalizedHits.length;
            keywordLastShown = normalizedHits.length;
            spellCountDiv.textContent = `关键词“${query}”命中 ${keywordLastTotal} 个法术，展示 ${keywordLastShown} 个`;
        } catch (error) {
            if (currentSeq !== keywordSearchSeq) return;
            console.warn('关键词接口不可用，回退本地过滤', error);
            await ensureSpellDataLoaded();
            const fallbackSpells = allSpells.filter(spell => spellMatchesKeyword(spell, normalizedQuery));
            displayKeywordTableResults(fallbackSpells);
            keywordLastTotal = fallbackSpells.length;
            keywordLastShown = fallbackSpells.length;
            spellCountDiv.textContent = `关键词“${query}”命中 ${keywordLastTotal} 个法术`;
        }
    };

    const displayProfessionResults = () => {
        renderProfessionWorkspace();
    };

    const displaySchoolResults = () => {
        renderSchoolWorkspace();
    };

    const getProfessionGroup = (key) => {
        if (!key || !professionIndex[key]) {
            return null;
        }
        return {
            key,
            displayName: professionNames[key] || key,
            spells: [...professionIndex[key]].sort((a, b) => a.level - b.level)
        };
    };

    const selectProfession = (key) => {
        if (!key) return;
        selectedProfession = key;
        currentProfessionGroup = getProfessionGroup(key);
        selectedLevel = professionLevelByKey[key] ?? null;
        renderProfessionWorkspace();
        refreshCountText('profession');
    };

    const getSchoolGroup = (key) => {
        if (!key || !schoolIndex[key]) {
            return null;
        }
        return {
            key,
            displayName: schoolNames[key] || key,
            spells: dedupeSpells(schoolIndex[key]),
        };
    };

    const selectSchool = (key) => {
        if (!key) return;
        selectedSchool = key;
        currentSchoolGroup = getSchoolGroup(key);
        renderSchoolWorkspace();
        refreshCountText('school');
    };

    const renderSchoolWorkspace = () => {
        resultsContainer.innerHTML = '';

        const root = document.createElement('div');
        root.className = 'profession-tab-workspace';

        const sidebar = document.createElement('aside');
        sidebar.className = 'profession-tab-sidebar';

        const sideTitle = document.createElement('div');
        sideTitle.className = 'profession-tab-sidebar-title';
        sideTitle.textContent = '学派';
        sidebar.appendChild(sideTitle);

        const sideList = document.createElement('div');
        sideList.className = 'profession-tab-sidebar-list';
        const entries = Object.keys(schoolNames)
            .map(key => ({ key, name: schoolNames[key], count: (schoolIndex[key] || []).length }))
            .sort((a, b) => {
                const ai = SCHOOL_ORDER.indexOf(a.name);
                const bi = SCHOOL_ORDER.indexOf(b.name);
                const ar = ai === -1 ? SCHOOL_ORDER.length : ai;
                const br = bi === -1 ? SCHOOL_ORDER.length : bi;
                return ar - br || a.name.localeCompare(b.name, 'zh-Hans');
            });

        entries.forEach(({ key, name, count }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'profession-sidebar-btn';
            btn.textContent = `${name} (${count})`;
            btn.classList.toggle('active', selectedSchool === key);
            btn.addEventListener('click', () => selectSchool(key));
            sideList.appendChild(btn);
        });
        sidebar.appendChild(sideList);

        const main = document.createElement('section');
        main.className = 'profession-tab-main';
        if (!currentSchoolGroup) {
            const empty = document.createElement('div');
            empty.className = 'profession-detail-empty';
            empty.textContent = '请先在左侧选择一个学派。';
            main.appendChild(empty);
            root.appendChild(sidebar);
            root.appendChild(main);
            resultsContainer.appendChild(root);
            return;
        }

        const layout = document.createElement('div');
        layout.className = 'profession-results-layout';

        const listPanel = document.createElement('div');
        listPanel.className = 'profession-list-panel';

        const detailPanel = document.createElement('div');
        detailPanel.className = 'profession-detail-panel';
        detailPanel.innerHTML = '<div class="profession-detail-empty">点击左侧法术查看详述。</div>';

        const section = document.createElement('section');
        section.className = 'profession-list-section';

        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'profession-list-section-title';
        sectionHeader.textContent = `${currentSchoolGroup.displayName}（${currentSchoolGroup.spells.length} 个）`;
        section.appendChild(sectionHeader);

        currentSchoolGroup.spells.forEach(spell => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'profession-spell-row';

            const name = document.createElement('span');
            name.className = 'profession-spell-row-name';
            name.textContent = spell.name || spell.display_name || '（未命名）';

            const source = document.createElement('span');
            source.className = 'profession-spell-row-level';
            source.textContent = spell.来源 || spell.source_book || '';

            row.appendChild(name);
            row.appendChild(source);
            row.addEventListener('click', () => {
                listPanel.querySelectorAll('.profession-spell-row').forEach(node => node.classList.remove('active'));
                row.classList.add('active');
                detailPanel.innerHTML = '';
                detailPanel.appendChild(renderSpellCard(spell));
            });
            section.appendChild(row);
        });

        listPanel.appendChild(section);
        layout.appendChild(listPanel);
        layout.appendChild(detailPanel);
        main.appendChild(layout);

        root.appendChild(sidebar);
        root.appendChild(main);
        resultsContainer.appendChild(root);
    };

    const renderProfessionWorkspace = () => {
        resultsContainer.innerHTML = '';

        const root = document.createElement('div');
        root.className = 'profession-tab-workspace';

        const sidebar = document.createElement('aside');
        sidebar.className = 'profession-tab-sidebar';

        const sideTitle = document.createElement('div');
        sideTitle.className = 'profession-tab-sidebar-title';
        sideTitle.textContent = '\u804c\u4e1a';
        sidebar.appendChild(sideTitle);

        const sideList = document.createElement('div');
        sideList.className = 'profession-tab-sidebar-list';
        const entries = Object.keys(professionNames)
            .map(key => ({ key, name: professionNames[key] }))
            .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans'));

        entries.forEach(({ key, name }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'profession-sidebar-btn';
            btn.textContent = name;
            btn.classList.toggle('active', selectedProfession === key);
            btn.addEventListener('click', () => selectProfession(key));
            sideList.appendChild(btn);
        });
        sidebar.appendChild(sideList);

        const main = document.createElement('section');
        main.className = 'profession-tab-main';
        if (!currentProfessionGroup) {
            const empty = document.createElement('div');
            empty.className = 'profession-detail-empty';
            empty.textContent = '\u8bf7\u5148\u5728\u5de6\u4fa7\u9009\u62e9\u4e00\u4e2a\u804c\u4e1a\u3002';
            main.appendChild(empty);
            root.appendChild(sidebar);
            root.appendChild(main);
            resultsContainer.appendChild(root);
            return;
        }

        const levelWrap = document.createElement('div');
        levelWrap.className = 'profession-inline-levels';

        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.textContent = '\u5168\u90e8\u73af\u4f4d';
        allBtn.classList.toggle('active', selectedLevel === null);
        allBtn.addEventListener('click', () => {
            professionLevelByKey[selectedProfession] = null;
            selectedLevel = null;
            renderProfessionWorkspace();
            refreshCountText('profession');
        });
        levelWrap.appendChild(allBtn);

        getProfessionLevelCounts(currentProfessionGroup).forEach(({ level, count }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = `${level}\u73af (${count})`;
            btn.classList.toggle('active', selectedLevel === level);
            btn.addEventListener('click', () => {
                professionLevelByKey[selectedProfession] = level;
                selectedLevel = level;
                renderProfessionWorkspace();
                refreshCountText('profession');
            });
            levelWrap.appendChild(btn);
        });
        main.appendChild(levelWrap);

        const visibleEntries = selectedLevel !== null
            ? currentProfessionGroup.spells.filter(entry => entry.level === selectedLevel)
            : currentProfessionGroup.spells;
        const scopedGroup = {
            ...currentProfessionGroup,
            spells: dedupeProfessionEntries(visibleEntries),
        };

        const layout = document.createElement('div');
        layout.className = 'profession-results-layout';

        const listPanel = document.createElement('div');
        listPanel.className = 'profession-list-panel';

        const detailPanel = document.createElement('div');
        detailPanel.className = 'profession-detail-panel';
        detailPanel.innerHTML = '<div class="profession-detail-empty">\u70b9\u51fb\u5de6\u4fa7\u6cd5\u672f\u67e5\u770b\u8be6\u8ff0\u3002</div>';

        const renderEntryButton = (entry) => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'profession-spell-row';

            const name = document.createElement('span');
            name.className = 'profession-spell-row-name';
            name.textContent = entry.spell.name || entry.spell.display_name || '\uff08\u672a\u547d\u540d\uff09';

            const level = document.createElement('span');
            level.className = 'profession-spell-row-level';
            level.textContent = `${entry.level}\u73af`;

            row.appendChild(name);
            row.appendChild(level);
            row.addEventListener('click', () => {
                listPanel.querySelectorAll('.profession-spell-row').forEach(node => node.classList.remove('active'));
                row.classList.add('active');
                detailPanel.innerHTML = '';
                detailPanel.appendChild(renderSpellCard(entry.spell));
            });
            return row;
        };

        getProfessionLevelGroups(scopedGroup).forEach(({ level, spells }) => {
            const section = document.createElement('section');
            section.className = 'profession-list-section';

            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'profession-list-section-title';
            sectionHeader.textContent = `${level}\u73af\uff08${spells.length} \u4e2a\uff09`;
            section.appendChild(sectionHeader);

            spells.forEach(entry => section.appendChild(renderEntryButton(entry)));
            listPanel.appendChild(section);
        });

        layout.appendChild(listPanel);
        layout.appendChild(detailPanel);
        main.appendChild(layout);

        root.appendChild(sidebar);
        root.appendChild(main);
        resultsContainer.appendChild(root);
    };

    // legacy compatibility no-op (profession list now rendered in results container left sidebar)
    const renderProfessionButtons = () => {};
    const renderLevelButtons = () => {};
    const setLevelFilter = () => {};
    const updateActiveProfessionButton = () => {};
    const updateActiveLevelButton = () => {};

    const resetProfessionSelection = () => {
        selectedProfession = null;
        currentProfessionGroup = null;
        selectedSchool = null;
        currentSchoolGroup = null;
        selectedLevel = null;
        Object.keys(professionLevelByKey).forEach(k => delete professionLevelByKey[k]);
    };

    const updateCountText = (mode) => {
        if (!spellsLoaded && mode !== 'rag') {
            spellCountDiv.textContent = '法术数据未加载，正在准备...';
            return;
        }
        if (mode === 'name' || mode === 'keyword') {
            const totalLoaded = resultsContainer.children.length;
            spellCountDiv.textContent = `显示 ${totalLoaded} / ${allSpells.length} 个法术`;
        } else if (mode === 'profession') {
            if (!currentProfessionGroup) {
                spellCountDiv.textContent = '请选择一个职业查看对应法术';
                return;
            }
            const totalSpells = selectedLevel !== null
                ? dedupeProfessionEntries(currentProfessionGroup.spells.filter(entry => entry.level === selectedLevel)).length
                : dedupeProfessionEntries(currentProfessionGroup.spells).length;
            const suffix = selectedLevel !== null ? `，仅包含 ${selectedLevel} 环` : '';
            spellCountDiv.textContent = `显示 ${totalSpells} 个法术，当前职业：${currentProfessionGroup.displayName}${suffix}`;
        } else if (mode === 'school') {
            if (!currentSchoolGroup) {
                spellCountDiv.textContent = '请选择一个学派查看对应法术';
                return;
            }
            spellCountDiv.textContent = `显示 ${currentSchoolGroup.spells.length} 个法术，当前学派：${currentSchoolGroup.displayName}`;
        }
    };

    const refreshCountText = (mode) => {
        if (!spellsLoaded && mode !== 'rag' && mode !== 'keyword') {
            spellCountDiv.textContent = '法术数据未加载，正在准备...';
            return;
        }
        if (mode === 'name') {
            const totalLoaded = resultsContainer.children.length;
            spellCountDiv.textContent = `显示 ${totalLoaded} / ${allSpells.length} 个法术`;
            return;
        }
        if (mode === 'keyword') {
            spellCountDiv.textContent = `关键词结果：${keywordLastShown} / ${keywordLastTotal}`;
            return;
        }
        if (mode === 'school') {
            if (!currentSchoolGroup) {
                spellCountDiv.textContent = '请选择一个学派查看对应法术';
                return;
            }
            spellCountDiv.textContent = `显示 ${currentSchoolGroup.spells.length} 个法术，当前学派：${currentSchoolGroup.displayName}`;
            return;
        }
        if (!currentProfessionGroup) {
            spellCountDiv.textContent = '请选择一个职业查看对应法术';
            return;
        }
        const totalSpells = selectedLevel !== null
            ? dedupeProfessionEntries(currentProfessionGroup.spells.filter(entry => entry.level === selectedLevel)).length
            : dedupeProfessionEntries(currentProfessionGroup.spells).length;
        const suffix = selectedLevel !== null ? `，仅包含 ${selectedLevel} 环` : '';
        spellCountDiv.textContent = `显示 ${totalSpells} 个法术，当前职业：${currentProfessionGroup.displayName}${suffix}`;
    };

    const updatePlaceholder = () => {
        const mode = modeSelect.value;
        if (mode === 'profession') {
            searchInput.placeholder = '根据职业点击下方按钮';
        } else if (mode === 'school') {
            searchInput.placeholder = '根据学派点击左侧按钮';
        } else if (mode === 'keyword') {
            searchInput.placeholder = '输入关键词后点击搜索';
        } else if (mode === 'rag') {
            searchInput.placeholder = '切换到智能问答模式';
        } else {
            searchInput.placeholder = '输入法术名称搜索...';
        }
    };

    const toggleSearchMode = () => {
        const mode = modeSelect.value;
        const isKeyword = mode === 'keyword';
        const isProfession = mode === 'profession';
        const isSchool = mode === 'school';
        const isRag = mode === 'rag';

        nameSearchBox.classList.toggle('hidden', isProfession || isSchool || isRag);
        professionSelector.classList.add('hidden');
        levelSelector.classList.add('hidden');
        ragPanel.classList.toggle('hidden', !isRag);
        resultsContainer.classList.toggle('hidden', isRag);
        resultsContainer.classList.toggle('profession-mode', isProfession || isSchool);
        resultsContainer.classList.toggle('keyword-mode', isKeyword);
        if (!isProfession) {
            levelSelector.innerHTML = '';
            levelSelector.classList.add('hidden');
            levelSelector.style.setProperty('display', 'none', 'important');
            levelSelector.setAttribute('aria-hidden', 'true');
        }

        if (keywordSearchBtn) {
            keywordSearchBtn.classList.toggle('hidden', !isKeyword);
        }

        const hints = {
            name: '输入法术名称搜索',
            keyword: '输入关键词后点击搜索，查看索引列表',
            profession: '按职业时点击职业按钮，再选环位',
            school: '按学派时选择学派，查看该学派法术',
            rag: 'RAG 服务' + (ragServiceOnline ? '在线 ?' : '离线 ?')
        };
        if (modeHint) {
            modeHint.textContent = hints[mode] || '';
        }
    };

    const runSearch = () => {
        const mode = modeSelect.value;
        if (mode === 'rag') {
            return;
        }
        if (mode === 'keyword') {
            runKeywordSearchByButton().catch(error => {
                console.error('关键词搜索失败:', error);
                resultsContainer.textContent = '关键词搜索失败';
            });
            return;
        }
        if (mode === 'profession') {
            displayProfessionResults();
            refreshCountText(mode);
            return;
        }
        if (mode === 'school') {
            displaySchoolResults();
            refreshCountText(mode);
            return;
        }

        const normalizedQuery = normalize(searchInput.value);
        if (!normalizedQuery) {
            resultsContainer.textContent = '\u8bf7\u8f93\u5165\u6cd5\u672f\u540d\u79f0\u540e\u641c\u7d22\u3002';
            spellCountDiv.textContent = '\u540d\u79f0\u6a21\u5f0f\uff1a\u7b49\u5f85\u8f93\u5165';
            return;
        }
        const filteredSpells = allSpells.filter(spell => normalize(spell.name).includes(normalizedQuery) || normalize(spell.display_name).includes(normalizedQuery));
        displayNameResults(filteredSpells);
        refreshCountText(mode);
    };

    const ensureSpellDataLoaded = () => {
        if (spellsLoaded) {
            return Promise.resolve();
        }
        if (spellsLoadingPromise) {
            return spellsLoadingPromise;
        }

        spellCountDiv.textContent = '正在加载法术数据...';
        resultsContainer.textContent = '正在加载，请稍候...';

        spellsLoadingPromise = ensureSpellSourcesLoaded()
            .then(() => Promise.all(dataSourceUrls.map(url => fetch(url))))
            .then(responses => {
                responses.forEach((res, idx) => {
                    if (!res.ok) {
                        throw new Error(`第 ${idx + 1} 个数据源加载失败: ${res.status} (${dataSourceUrls[idx]})`);
                    }
                });
                return Promise.all(responses.map(res => res.json()));
            })
            .then((datasets) => {
                allSpells = datasets
                    .flat()
                    .map(normalizeSpell)
                    .filter(Boolean);
                buildProfessionIndex(allSpells);
                buildSchoolIndex(allSpells);
                renderProfessionButtons();
                spellsLoaded = true;
            })
            .catch(error => {
                console.error('Error loading spells:', error);
                spellCountDiv.textContent = '加载法术数据失败。请确保通过 Web 服务器运行。';
                resultsContainer.textContent = '加载失败';
                throw error;
            })
            .finally(() => {
                spellsLoadingPromise = null;
            });

        return spellsLoadingPromise;
    };

    const checkRagHealth = async () => {
        try {
            const res = await fetch('/api/health');
            if (res.ok) {
                const data = await res.json();
                ragServiceOnline = data.status === 'ok';
                if (modeSelect.value === 'rag' && modeHint) {
                    modeHint.textContent = 'RAG 服务' + (ragServiceOnline ? '在线 ✅' : '离线 ❌');
                }
            } else {
                ragServiceOnline = false;
            }
        } catch (error) {
            ragServiceOnline = false;
            console.error('RAG 健康检查失败:', error);
        }
    };

    const askRag = async (question, filters = {}, apiKey = '') => {
        if (!ragServiceOnline) {
            ragStatus.textContent = '❌ RAG 服务不可用，请检查后端服务是否运行。';
            ragStatus.classList.remove('hidden');
            return;
        }
        if (!apiKey.trim()) {
            ragStatus.textContent = '请输入 API Key 后再使用智能问答。';
            ragStatus.classList.remove('hidden');
            ragAnswer.classList.add('hidden');
            if (ragApiKeyInput) {
                ragApiKeyInput.focus();
            }
            return;
        }

        ragStatus.textContent = '🔍 思考中...';
        ragStatus.classList.remove('hidden');
        ragAnswer.classList.add('hidden');

        try {
            const res = await fetch('/api/rag/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, top_k: 20, filters, api_key: apiKey.trim() })
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            }

            const data = await res.json();

            let statusText = `找到 ${data.retrieved_count} 条相关法术，耗时 ${data.latency_ms}ms${data.degraded ? ' (降级模式)' : ''}`;
            if (data.degraded && data.llm_error) {
                statusText += `，原因: ${data.llm_error}`;
            }
            ragStatus.textContent = statusText;
            
            renderRagAnswer(data);
        } catch (err) {
            ragStatus.textContent = '❌ 请求失败: ' + err.message;
            console.error('RAG 请求失败:', err);
        }
    };

    // 默认 RAG 模式：不预加载全量法术数据，降低初始内存占用
    resultsContainer.textContent = '智能问答模式已启用。若切换到名称/职业/学派模式，将按需加载法术数据。';

    const debouncedRunSearch = debounce(() => {
        if (modeSelect.value === 'rag' || modeSelect.value === 'keyword') return;
        ensureSpellDataLoaded().then(() => runSearch()).catch(() => {});
    }, 300);

    searchInput.addEventListener('input', debouncedRunSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && modeSelect.value === 'keyword') {
            runSearch();
        }
    });

    if (keywordSearchBtn) {
        keywordSearchBtn.addEventListener('click', () => runSearch());
    }

    modeSelect.addEventListener('change', () => {
        const mode = modeSelect.value;
        resetProfessionSelection();
        updatePlaceholder();
        toggleSearchMode();

        // Always reset visible results when switching search mode.
        resultsContainer.innerHTML = '';
        keywordLastTotal = 0;
        keywordLastShown = 0;

        if (mode === 'rag') {
            runSearch();
            return;
        }
        if (mode === 'keyword') {
            resultsContainer.textContent = '\u8bf7\u8f93\u5165\u5173\u952e\u8bcd\u540e\u70b9\u51fb\u201c\u641c\u7d22\u201d\u3002';
            spellCountDiv.textContent = '\u5173\u952e\u8bcd\u6a21\u5f0f\uff1a\u7b49\u5f85\u641c\u7d22';
            return;
        }
        if (mode === 'profession') {
            ensureSpellDataLoaded().then(() => {
                renderProfessionButtons();
                displayProfessionResults();
                refreshCountText('profession');
            }).catch(() => {});
            return;
        }
        if (mode === 'school') {
            ensureSpellDataLoaded().then(() => {
                displaySchoolResults();
                refreshCountText('school');
            }).catch(() => {});
            return;
        }

        // name mode
        ensureSpellDataLoaded().then(() => {
            resultsContainer.textContent = '\u8bf7\u8f93\u5165\u6cd5\u672f\u540d\u79f0\u540e\u641c\u7d22\u3002';
            spellCountDiv.textContent = '\u540d\u79f0\u6a21\u5f0f\uff1a\u7b49\u5f85\u8f93\u5165';
        }).catch(() => {});
    });

    // RAG 相关事件
    if (ragSubmit) {
        const debouncedAskRag = debounce((question, filters) => {
            const apiKey = ragApiKeyInput ? ragApiKeyInput.value : '';
            askRag(question, filters, apiKey);
        }, 400);
        ragSubmit.addEventListener('click', () => {
            const question = ragInput.value.trim();
            if (!question) {
                ragStatus.textContent = '请输入问题。';
                ragStatus.classList.remove('hidden');
                ragInput.focus();
                return;
            }
            if (!ragApiKeyInput || !ragApiKeyInput.value.trim()) {
                ragStatus.textContent = '请输入 API Key 后再使用智能问答。';
                ragStatus.classList.remove('hidden');
                if (ragApiKeyInput) {
                    ragApiKeyInput.focus();
                }
                return;
            }

            const filters = {};
            const sourceFilter = document.getElementById('rag-source-filter');
            const typeFilter = document.getElementById('rag-type-filter');
            const schoolFilter = document.getElementById('rag-school-filter');
            const levelFilter = document.getElementById('rag-level-filter');

            if (sourceFilter && sourceFilter.value) {
                filters.source = sourceFilter.value;
            }
            if (typeFilter && typeFilter.value) {
                filters.spell_type = typeFilter.value;
            }
            if (schoolFilter && schoolFilter.value) {
                filters.school = schoolFilter.value;
            }
            if (levelFilter && levelFilter.value) {
                filters.max_level = parseInt(levelFilter.value);
            }

            debouncedAskRag(question, filters);
        });
    }

    if (ragInput) {
        ragInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && ragSubmit) {
                ragSubmit.click();
            }
        });
    }

    // 初始化
    modeSelect.value = 'rag';
    updatePlaceholder();
    toggleSearchMode();
    ensureSpellSourcesLoaded();
    checkRagHealth();
    // 定期检查 RAG 服务状态
    setInterval(checkRagHealth, 30000); // 每30秒检查一次
});
