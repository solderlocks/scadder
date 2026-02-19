// ── Parameter UI Builder ──────────────────────────────────────────────────────

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
            const h = document.createElement('div');
            h.className = 'param-group-label';
            h.textContent = group.name;
            grid.appendChild(h);
        }

        for (const p of group.params) {
            const item = document.createElement('div');
            item.className = 'param-item';

            const lbl = document.createElement('label');
            lbl.className = 'param-label';
            lbl.innerHTML = `${p.label}`;
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
                const row = document.createElement('div');
                row.className = 'param-check-row';

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'param-checkbox';
                cb.checked = p.value;

                const lbl2 = document.createElement('span');
                lbl2.style.cssText = 'font-family:var(--mono);font-size:0.78rem;color:var(--text-mid)';
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

            grid.appendChild(item);
        }
    }
}

// ── State Management (URL Sync) ───────────────────────────────────────────────

function updateUrlState() {
    const state = {};
    let hasChanges = false;

    for (const p of parsedParams) {
        if (p.value !== p.defaultVal) {
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
    } catch (e) {
        console.error("Failed to parse URL vars:", e);
    }
}
