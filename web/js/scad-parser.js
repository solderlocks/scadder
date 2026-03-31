// ── OpenSCAD Parameter Parser ─────────────────────────────────────────────────

function parseScadParams(code) {
    const groups = [];

    // 1. Keep the standard "Named Parameters" group (for variables)
    const globalGroup = { name: "Named Variables", params: [] };
    groups.push(globalGroup);

    // 2. Create a new "Magic Numbers" group
    const magicGroup = { name: "Raw Values (Magic Numbers)", params: [] };
    groups.push(magicGroup);

    const lines = code.split('\n');

    // Helper for safe evaluation
    const evaluate = (str) => {
        try {
            let result = Function(`"use strict"; return (${str})`)();

            // If it's an array of two numbers where the second is 0, just return the first number.
            if (Array.isArray(result) && result.length === 2 && typeof result[0] === 'number') {
                return result[0];
            }

            return result;
        } catch (e) { return null; }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const t = line.trim();
        if (t.startsWith('//') || t.length === 0) continue; // Skip comments/empty

        // ── STRATEGY A: Named Variables ──
        const varMatch = t.match(/^([ \t]*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([^;]+?)\s*;(?:\s*\/\/\s*(.*))?/);

        if (varMatch) {
            const [, indent, name, rawVal, comment] = varMatch;

            // Skip system vars
            if (name === '$fn' || name === '$fa' || name === '$fs') continue;

            let type = 'number';
            let val = rawVal.trim();
            let computedVal = val;

            if (val === 'true' || val === 'false') {
                type = 'boolean';
                computedVal = (val === 'true');
            } else if (val.startsWith('"') || val.startsWith("'")) {
                type = 'string';
                computedVal = val.replace(/^["']|["']$/g, '');
            } else {
                const mathResult = evaluate(val);
                if (mathResult !== null && !isNaN(mathResult)) {
                    computedVal = mathResult;
                } else {
                    type = 'raw';
                }
            }

            // Range comments
            let min, max, step;
            if (comment) {
                const range = comment.match(/\[(-?[\d.]+):(-?[\d.]+)\]/);
                if (range) { min = parseFloat(range[1]); max = parseFloat(range[2]); step = 1; type = 'range'; }
            }

            globalGroup.params.push({
                name, type,
                value: computedVal,
                defaultVal: computedVal,
                rawValue: val,
                min, max, step,
                lineIndex: i,
                label: name.replace(/_(mm|cm|in|inches|deg|pct|percent)\b/gi, ''),
                isMagic: false
            });

            continue;
        }

        // ── STRATEGY B: Magic Numbers ──
        const numberPattern = /(?<![\w$])(-?\d+\.?\d*)(?![\w$])/g;
        let match;
        while ((match = numberPattern.exec(line)) !== null) {
            const valStr = match[1];
            const val = parseFloat(valStr);

            if (isNaN(val)) continue;
            if (val === 0 || val === 1) continue;
            if (val === 100 || val === 360) continue;

            const preStr = line.substring(0, match.index);
            const contextMatch = preStr.match(/([a-zA-Z0-9_]+)\s*[(\[]\s*[^()\[\]]*$/);
            let contextLabel = contextMatch ? contextMatch[1] : "Value";

            magicGroup.params.push({
                name: `magic_${i}_${match.index}`,
                type: 'number',
                value: val,
                defaultVal: val,
                lineIndex: i,
                charIndex: match.index,
                strLength: valStr.length,
                isMagic: true,
                label: `${contextLabel} (L${i + 1})`
            });
        }
    }

    return groups.filter(g => g.params.length > 0);
}

// ── Inject current param values into SCAD source ──────────────────────────────
function buildModifiedScad(originalCode) {
    const lines = originalCode.split('\n');
    const changesByLine = {};

    for (const p of parsedParams) {
        if (p.value !== p.defaultVal) {
            if (!changesByLine[p.lineIndex]) changesByLine[p.lineIndex] = [];
            changesByLine[p.lineIndex].push(p);
        }
    }

    for (const [lineIdx, params] of Object.entries(changesByLine)) {
        let originalLine = lines[lineIdx];

        // Case 1: Magic Numbers (Needs complex splicing)
        const isMagicLine = params.some(p => p.isMagic);

        if (isMagicLine) {
            params.sort((a, b) => a.charIndex - b.charIndex);
            let newLine = "";
            let cursor = 0;
            for (const p of params) {
                newLine += originalLine.substring(cursor, p.charIndex);
                newLine += String(p.value);
                cursor = p.charIndex + p.strLength;
            }
            newLine += originalLine.substring(cursor);
            lines[lineIdx] = newLine;
        }

        // Case 2: Named Variables (Simple Regex Replace)
        else {
            const p = params[0];
            let valStr = p.value;
            if (p.type === 'string') valStr = `"${p.value}"`;

            lines[lineIdx] = originalLine.replace(
                /^([ \t]*[a-zA-Z0-9_$]+\s*=\s*)([^;]+)(;.*)/,
                `$1${valStr}$3`
            );
        }
    }

    return lines.join('\n');
}

/**
 * Parses "Scadder Docblocks" (JSDoc-style comments at top of file)
 * to extract authoritative metadata.
 */
function parseScadderDocblock(code) {
    const docblockMatch = code.match(/^\/\*\*([\s\S]*?)\*\//);
    if (!docblockMatch) return null;

    const block = docblockMatch[1];
    const metadata = {};
    const tags = {
        name: /@name\s+(.*)/,
        description: /@description\s+(.*)/,
        author: /@author\s+(.*)/,
        version: /@version\s+(.*)/,
        requires: /@requires\s+(.*)/,
        tag: /@tag\s+(.*)/g
    };

    for (const [key, regex] of Object.entries(tags)) {
        if (key === 'tag') {
            const matches = [...block.matchAll(regex)];
            if (matches.length > 0) {
                metadata.tags = matches.map(m => m[1].trim());
            }
        } else {
            const match = block.match(regex);
            if (match) metadata[key] = match[1].trim();
        }
    }

    return metadata;
}
