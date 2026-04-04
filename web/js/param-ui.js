// ── Parameter UI Builder ──────────────────────────────────────────────────────

// Tooltip text for each group type
const GROUP_TOOLTIPS = {
    "Named Variables": "These are explicitly declared variables in the .scad file. They're designed by the author to be configurable — think dimensions, counts, and toggles.",
    "Raw Values (Magic Numbers)": "These are values found in the code that aren't assigned to named variables. Changing them can produce interesting results, but may also break the model. Use with care!"
};

// Friendly display names
const GROUP_DISPLAY_NAMES = {
    "Named Variables": "Parameters",
    "Raw Values (Magic Numbers)": "Advanced · Raw Values"
};


function buildParamUI(groups) {
    const grid = document.getElementById('paramGrid');
    grid.innerHTML = '';
    // Flatten groups for global search
    parsedParams = groups.flatMap(g => g.params);

    if (parsedParams.length === 0) {
        grid.innerHTML = '<p class="no-params">No configurable parameters found.</p>';
        return;
    }

    document.getElementById('paramCount').textContent =
        `${parsedParams.length} param${parsedParams.length !== 1 ? 's' : ''}`;

    for (const group of groups) {
        if (group.name) {
            const section = document.createElement('div');
            section.className = 'param-group-section';

            // Build header
            const header = document.createElement('div');
            const isMagic = group.name.includes('Magic');
            header.className = isMagic ? 'param-group-header' : 'param-group-header static-header';

            const hasNamedParams = groups.some(g => g.name && !g.name.includes('Magic') && g.params.length > 0);
            const startCollapsed = isMagic && hasNamedParams;
            const displayName = GROUP_DISPLAY_NAMES[group.name] || group.name;
            const tooltip = GROUP_TOOLTIPS[group.name] || '';

            const toggleIcon = document.createElement('span');
            toggleIcon.className = 'param-group-toggle';
            toggleIcon.textContent = startCollapsed ? '+' : '-';

            const title = document.createElement('span');
            title.className = 'param-group-title';
            title.textContent = displayName;

            if (isMagic) {
                header.appendChild(toggleIcon);
            }
            header.appendChild(title);

            // Info tooltip
            if (tooltip) {
                const tip = document.createElement('span');
                tip.className = 'info-tip';
                tip.textContent = 'i';
                const tipContent = document.createElement('span');
                tipContent.className = 'tip-content';
                tipContent.textContent = tooltip;
                tip.appendChild(tipContent);
                // Prevent toggling accordion when clicking info tip
                tip.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                header.appendChild(tip);
            }

            // Count badge
            const count = document.createElement('span');
            count.className = 'param-group-count';
            count.textContent = `${group.params.length}`;
            header.appendChild(count);

            if (isMagic) {
                section.appendChild(header);
            }

            // Build inner grid for params
            const innerGrid = document.createElement('div');
            innerGrid.className = `param-group-grid${startCollapsed ? ' collapsed' : ''}`;

            if (isMagic) {
                // Toggle on click
                header.addEventListener('click', () => {
                    const isCollapsed = innerGrid.classList.contains('collapsed');
                    innerGrid.classList.toggle('collapsed', !isCollapsed);
                    toggleIcon.textContent = isCollapsed ? '-' : '+';
                });
            }

            // Add params to inner grid
            for (const p of group.params) {
                innerGrid.appendChild(buildParamItem(p));
            }

            section.appendChild(innerGrid);
            grid.appendChild(section);
        } else {
            // No group name — add params directly
            for (const p of group.params) {
                grid.appendChild(buildParamItem(p));
            }
        }
    }

    // Initialize sticky render bar after params are built
    if (typeof initStickyRenderBar === 'function') initStickyRenderBar();
}

function buildParamItem(p) {
    const item = document.createElement('div');
    item.className = 'param-item';

    const lbl = document.createElement('label');
    lbl.className = 'param-label';
    lbl.textContent = p.label;

    // ── Tooltip ──
    if (p.description && p.description.trim()) {
        const tip = document.createElement('span');
        tip.className = 'info-tip';
        tip.textContent = 'i';
        const tipContent = document.createElement('span');
        tipContent.className = 'tip-content';
        tipContent.textContent = p.description;
        tip.appendChild(tipContent);
        lbl.appendChild(tip);
    }
    item.appendChild(lbl);

    // ── RANGE SLIDER ──
    if (p.type === 'range') {
        const row = document.createElement('div');
        row.className = 'param-range-row';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'param-slider';
        slider.min = p.min; slider.max = p.max;
        slider.step = p.step || 1;
        slider.value = p.value;

        // Detent for default value
        const dl = document.createElement('datalist');
        const dlId = `dl_${p.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        dl.id = dlId;
        const opt = document.createElement('option');
        opt.value = p.defaultVal;
        dl.appendChild(opt);
        row.appendChild(dl);
        slider.setAttribute('list', dlId);

        const numbox = document.createElement('input');
        numbox.type = 'number';
        numbox.className = 'param-numbox';
        numbox.min = p.min; numbox.max = p.max;
        numbox.step = p.step || 1;
        numbox.value = p.value;

        slider.oninput = () => {
            numbox.value = slider.value;
            p.value = parseFloat(slider.value);
            updateUrlState();
        };
        numbox.oninput = () => {
            slider.value = numbox.value;
            p.value = parseFloat(numbox.value);
            updateUrlState();
        };

        row.appendChild(slider);
        row.appendChild(numbox);
        item.appendChild(row);

        // ── CHECKBOX ──
    } else if (p.type === 'boolean') {
        const row = document.createElement('label'); // Use <label> for entire row
        row.className = 'param-check-row';
        row.style.cursor = 'pointer';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'param-checkbox';
        cb.checked = p.value;

        const lbl2 = document.createElement('span');
        lbl2.style.cssText = 'font-family:var(--mono);font-size:0.78rem;color:var(--text-mid);';
        lbl2.textContent = p.value ? 'true' : 'false';

        cb.onchange = () => {
            p.value = cb.checked;
            lbl2.textContent = cb.checked ? 'true' : 'false';
            updateUrlState();
        };

        row.appendChild(cb); row.appendChild(lbl2);
        item.appendChild(row);

        // ── DROPDOWN ──
    } else if (p.type === 'select') {
        const sel = document.createElement('select');
        sel.className = 'param-select';
        for (const opt of p.options) {
            const o = document.createElement('option');
            o.value = opt; o.textContent = opt;
            if (opt === p.value) o.selected = true;
            sel.appendChild(o);
        }
        sel.onchange = () => {
            p.value = sel.value;
            updateUrlState();
        };
        item.appendChild(sel);

        // ── STANDARD INPUT (Number/Text/Magic) ──
    } else {
        const isNumeric = (p.type === 'number' || (!p.type && typeof p.value === 'number'));

        if (isNumeric) {
            // Intelligent Auto-Sliders
            const row = document.createElement('div');
            row.className = 'param-range-row';

            const min = 0;
            const max = p.value === 0 ? 100 : p.value * 2;

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'param-slider';
            slider.min = min; slider.max = max;
            slider.step = 0.1;
            slider.value = p.value;

            // Detent for default value
            const dl = document.createElement('datalist');
            const dlId = `dl_${p.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
            dl.id = dlId;
            const opt = document.createElement('option');
            opt.value = p.defaultVal;
            dl.appendChild(opt);
            row.appendChild(dl);
            slider.setAttribute('list', dlId);

            const numbox = document.createElement('input');
            numbox.type = 'number';
            numbox.className = 'param-numbox';
            numbox.step = 0.1;
            numbox.value = p.value;

            slider.oninput = () => {
                numbox.value = slider.value;
                p.value = parseFloat(slider.value);
                updateUrlState();
            };
            numbox.oninput = () => {
                slider.value = numbox.value;
                p.value = parseFloat(numbox.value);
                updateUrlState();
            };

            row.appendChild(slider);
            row.appendChild(numbox);
            item.appendChild(row);
        } else {
            const inp = document.createElement('input');
            inp.type = (p.type === 'string' || p.type === 'raw') ? 'text' : 'number';
            inp.className = 'param-input';
            inp.value = p.value;

            inp.oninput = () => {
                p.value = inp.type === 'number' ? parseFloat(inp.value) : inp.value;
                updateUrlState();
            };
            item.appendChild(inp);
        }
    }

    return item;
}

// ── State Management (URL Sync) ───────────────────────────────────────────────

function updateUrlState() {
    const state = {};
    let hasChanges = false;

    for (const p of parsedParams) {
        if (p.value != p.defaultVal) {
            state[p.name] = p.value;
            hasChanges = true;
        }
    }

    const u = new URL(window.location.href);
    if (hasChanges) {
        u.searchParams.set('vars', JSON.stringify(state));
    } else {
        u.searchParams.delete('vars');
    }
    window.history.replaceState({}, '', u.toString());
    if (typeof updateStickyBarDirty === 'function') updateStickyBarDirty();
}

function applyUrlState() {
    const params = new URLSearchParams(window.location.search);
    const varsParam = params.get('vars');
    if (!varsParam) return;

    try {
        const state = JSON.parse(varsParam);

        const cleanValue = (val) => {
            if (typeof val !== 'string') return val;

            // Check if it's a numeric string first
            if (!isNaN(val) && !isNaN(parseFloat(val))) {
                return parseFloat(val);
            }

            // Try to evaluate arrays or objects
            try {
                if (val.trim().startsWith('[') || val.trim().startsWith('{')) {
                    const result = Function(`"use strict"; return (${val})`)();
                    return result;
                }
            } catch (e) {
                // Fall through
            }

            return val;
        };

        for (const p of parsedParams) {
            if (state.hasOwnProperty(p.name)) {
                p.value = cleanValue(state[p.name]);
            }
        }

        // Prune orphaned variables out of the URL
        updateUrlState();
    } catch (e) {
        console.error("Failed to parse URL vars:", e);
    }
}
