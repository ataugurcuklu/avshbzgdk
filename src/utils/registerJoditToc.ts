import { slugify } from './slugify';

// Minimal styles for the slide-over panel and controls. The plugin will
// inject a single <style id="jodit-toc-style"> tag so it can be safely
// removed/replaced in dev mode.
const CSS_ID = 'jodit-toc-style';
function injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = `
  .jodit-toc-panel { position: fixed; right: 360px; top: 60px; width: 360px; max-height: 70vh; background: #fff; border:1px solid rgba(0,0,0,0.08); box-shadow: 0 10px 30px rgba(0,0,0,0.12); z-index:10000; padding:12px; overflow:auto; border-radius:8px; font-family: system-ui,Segoe UI,Roboto,Helvetica,Arial; }
  .jodit-toc-header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px }
  .jodit-toc-list { margin:0; padding-left:18px; font-size:13px }
  .jodit-toc-controls { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px }
  .jodit-toc-btn, .jodit-toc-action { cursor:pointer; background:#0366d6; color:#fff; border:none; padding:6px 8px; border-radius:6px }
  .jodit-toc-action.secondary { background:#6b7280 }
  .jodit-toc-small { font-size:12px; color:#374151 }
  .jodit-toc-row { display:flex; gap:8px; align-items:center; padding:6px 0 }
  .jodit-toc-checkbox { transform:scale(1.05) }
  .jodit-toc-depth { width:60px }
  `;
    document.head.appendChild(style);
}

function ensureHeadingId(h: HTMLElement, existingIds: Set<string>, counterMap: Record<string, number>) {
    let id = h.getAttribute('id');
    if (!id) {
        const base = slugify((h.textContent || '').trim() || 'heading');
        const key = base || 'heading';
        counterMap[key] = (counterMap[key] || 0) + 1;
        id = `toc-${key}-${counterMap[key]}`;
        while (existingIds.has(id)) {
            counterMap[key] += 1;
            id = `toc-${key}-${counterMap[key]}`;
        }
        h.setAttribute('id', id);
        existingIds.add(id);
    } else {
        existingIds.add(id);
    }
    return id;
}

function collectItems(root: HTMLElement) {
    const headingEls = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6')) as HTMLElement[];
    const existingIds = new Set<string>(Array.from(root.querySelectorAll('[id]')).map((el: any) => el.id));
    const counterMap: Record<string, number> = {};

    const items = headingEls.map((h) => {
        const lvl = Math.max(1, Math.min(6, parseInt(h.tagName.substring(1), 10) || 1));
        const id = ensureHeadingId(h, existingIds, counterMap);
        return { id, text: (h.textContent || '').trim() || '(boş başlık)', level: lvl, el: h } as any;
    });
    return items;
}

function buildTocHtml(items: Array<{ id: string; text: string; level: number }>, numbered = false, maxDepth = 6) {
    if (!items.length) return '<div class="jodit-toc-empty">Başlık bulunamadı.</div>';
    const filtered = items.filter(i => i.level <= maxDepth);
    let html = '<div class="jodit-toc-wrapper" style="max-width:100%"><ol class="toc-root" style="margin:0;padding-left:18px">';
    const stack: number[] = [];
    let prevLevel = filtered[0].level;
    const counters: number[] = [];

    filtered.forEach((it) => {
        const level = it.level;
        if (numbered) {
            while (counters.length < level) counters.push(0);
            while (counters.length > level) counters.pop();
            counters[level - 1] = (counters[level - 1] || 0) + 1;
        }
        const label = numbered ? `${counters.slice(0, level).join('.')} ${escapeHtml(it.text)}` : escapeHtml(it.text);
        const li = `<li style="margin:4px 0"><a href=\"#${it.id}\">${label}</a></li>`;
        if (level === prevLevel) {
            html += li;
        } else if (level > prevLevel) {
            html += '<ol style="margin:4px 0 4px 16px">' + li;
            stack.push(level);
        } else {
            while (stack.length && stack[stack.length - 1] >= level) {
                html += '</ol>';
                stack.pop();
            }
            html += li;
        }
        prevLevel = level;
    });
    while (stack.length) { html += '</ol>'; stack.pop(); }
    html += '</ol></div>';
    return html;
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]); }

function insertHtmlAtCursor(editor: any, html: string) {
    try {
        if (editor && editor.s && typeof editor.s.insertHTML === 'function') { editor.s.insertHTML(html); return; }
    } catch (e) { /* swallow */ }
    try { if (editor && editor.od && typeof editor.od.execCommand === 'function') { editor.od.execCommand('insertHTML', false, html); return; } } catch (e) { /* swallow */ }
    try { document.execCommand('insertHTML', false, html); } catch (e) { console.error('Insert failed', e); }
}

function insertAtTop(root: HTMLElement, html: string) {
    const wrapper = document.createElement('div'); wrapper.innerHTML = html;
    if (root.firstChild) root.insertBefore(wrapper, root.firstChild); else root.appendChild(wrapper);
}

function replaceExistingToc(root: HTMLElement, html: string) {
    const existing = root.querySelector('.toc-root');
    if (existing) {
        const wrapper = document.createElement('div'); wrapper.innerHTML = html;
        existing.parentNode && existing.parentNode.replaceChild(wrapper, existing);
    } else insertAtTop(root, html);
}

function removeExistingToc(root: HTMLElement) {
    Array.from(root.querySelectorAll('.toc-root')).forEach(el => el.parentNode && el.parentNode.removeChild(el));
}

function addAnchors(items: any[]) {
    items.forEach((it) => {
        if (it.el && !it.el.querySelector('.toc-anchor')) {
            const span = document.createElement('span');
            span.className = 'toc-anchor'; span.style.display = 'block'; span.style.height = '0'; span.style.margin = '0';
            span.id = `anchor-${it.id}`;
            it.el.parentNode && it.el.parentNode.insertBefore(span, it.el);
        }
    });
}

// Enhanced export: register as a Jodit plugin when Jodit is available, otherwise
// fallback to the attach function used by the app.
function attach(editor: any) {
    if (!editor || typeof document === 'undefined') return;
    injectStyles();

    const debug = false;
    if (debug) console.debug('[TOC] attachJoditToc for', editor && (editor.container || editor));

    // find toolbar and avoid double-insert
    try {
        const toolbar = editor.container && editor.container.querySelector && (editor.container.querySelector('.jodit-toolbar') || editor.container.querySelector('.jodit-tools') || editor.container.querySelector('.jodit-toolbar__box') || editor.container.querySelector('[role="toolbar"]'));
        const makeButton = () => {
            const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'jodit-toc-btn'; btn.title = 'İçindekiler (TOC)'; btn.textContent = 'TOC';
            btn.onclick = (e) => { e.preventDefault(); openPanel(); };
            return btn;
        };

        if (toolbar) {
            if (!toolbar.querySelector('.jodit-toc-btn')) toolbar.appendChild(makeButton());
        } else {
            // fallback floating button
            const container = editor.container || editor.editor || (editor.j && editor.j.workplace) || null;
            if (container && container.querySelector && !container.querySelector('.jodit-toc-float')) {
                const floatBtn = document.createElement('button'); floatBtn.type = 'button'; floatBtn.className = 'jodit-toc-float'; floatBtn.textContent = 'TOC';
                floatBtn.style.position = 'absolute'; floatBtn.style.right = '8px'; floatBtn.style.top = '8px'; floatBtn.style.zIndex = '9999';
                floatBtn.onclick = (e) => { e.preventDefault(); openPanel(); };
                const parent = (container as HTMLElement).closest ? (container as HTMLElement).closest('.jodit-container') || (container as HTMLElement) : (container as HTMLElement);
                if (parent && parent instanceof HTMLElement && getComputedStyle(parent).position === 'static') (parent as HTMLElement).style.position = 'relative';
                (parent || container).appendChild(floatBtn as any);
            }
        }
    } catch (err) { console.error('[TOC] button injection failed', err); }

    // Panel state
    let panel: HTMLElement | null = null;
    function openPanel() {
        if (panel) return; // already open
        const root = editor.editor || (editor.container && editor.container.querySelector('.jodit-wysiwyg')) || (editor.j && editor.j.workplace) || editor.container;
        if (!root) { alert('Editor DOM bulunamadı'); return; }

        const items = collectItems(root as HTMLElement);

        panel = document.createElement('div'); panel.className = 'jodit-toc-panel';

        const header = document.createElement('div'); header.className = 'jodit-toc-header';
        const title = document.createElement('div'); title.innerHTML = '<strong>İçindekiler (TOC)</strong><div class="jodit-toc-small">Başlık sayısı: ' + items.length + '</div>';
        const close = document.createElement('button'); close.className = 'jodit-toc-action secondary'; close.textContent = 'Kapat'; close.onclick = () => { panel && panel.remove(); panel = null; };
        header.appendChild(title); header.appendChild(close);
        panel.appendChild(header);

        // Options
        const opts = document.createElement('div'); opts.className = 'jodit-toc-controls';
        const numberedLabel = document.createElement('label'); numberedLabel.className = 'jodit-toc-small';
        const numberedChk = document.createElement('input'); numberedChk.type = 'checkbox'; numberedChk.style.marginRight = '6px'; numberedLabel.appendChild(numberedChk); numberedLabel.appendChild(document.createTextNode('Numaralandır'));
        const depthSel = document.createElement('select'); depthSel.className = 'jodit-toc-depth'; [1,2,3,4,5,6].forEach(n => { const o = document.createElement('option'); o.value = String(n); o.text = 'H' + n; depthSel.appendChild(o); });
        const insertBtn = document.createElement('button'); insertBtn.className = 'jodit-toc-btn'; insertBtn.textContent = 'Ekle (imleç)';
        const insertTopBtn = document.createElement('button'); insertTopBtn.className = 'jodit-toc-action'; insertTopBtn.textContent = 'Ekle (baş)';
        const replaceBtn = document.createElement('button'); replaceBtn.className = 'jodit-toc-action'; replaceBtn.textContent = 'Değiştir';
        const removeBtn = document.createElement('button'); removeBtn.className = 'jodit-toc-action secondary'; removeBtn.textContent = 'Kaldır';
        const anchorsBtn = document.createElement('button'); anchorsBtn.className = 'jodit-toc-action'; anchorsBtn.textContent = 'Çapaları Ekle';

        opts.appendChild(numberedLabel); opts.appendChild(depthSel); opts.appendChild(insertBtn); opts.appendChild(insertTopBtn); opts.appendChild(replaceBtn); opts.appendChild(removeBtn); opts.appendChild(anchorsBtn);
        panel.appendChild(opts);

        // Live preview
        const preview = document.createElement('div'); preview.id = 'jodit-toc-preview'; preview.style.marginTop = '8px';
        const updatePreview = () => { const depth = parseInt(depthSel.value, 10); preview.innerHTML = buildTocHtml(items, numberedChk.checked, depth); };
        numberedChk.onchange = updatePreview; depthSel.onchange = updatePreview; updatePreview();
        panel.appendChild(preview);

        // Row list with checkboxes for selective insertion
        const listRoot = document.createElement('div'); listRoot.style.marginTop = '8px';
        items.forEach((it, idx) => {
            const row = document.createElement('div'); row.className = 'jodit-toc-row';
            const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = true; chk.className = 'jodit-toc-checkbox'; chk.dataset.index = String(idx);
            const lvl = document.createElement('div'); lvl.textContent = 'H' + it.level; lvl.className = 'jodit-toc-small'; lvl.style.width = '36px';
            const label = document.createElement('div'); label.textContent = it.text; label.style.flex = '1'; label.style.fontSize = '13px';
            row.appendChild(chk); row.appendChild(lvl); row.appendChild(label);
            listRoot.appendChild(row);
        });
        panel.appendChild(listRoot);

        // helpers to get selected
        const getSelected = () => {
            const checks = Array.from(listRoot.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
            return checks.filter(c => c.checked).map(c => items[parseInt(c.dataset.index || '0', 10)]).filter(Boolean);
        };

        insertBtn.onclick = () => { const selected = getSelected(); const depth = parseInt(depthSel.value, 10); const html = buildTocHtml(selected, numberedChk.checked, depth); insertHtmlAtCursor(editor, html); panel && panel.remove(); panel = null; };
        insertTopBtn.onclick = () => { const selected = getSelected(); const depth = parseInt(depthSel.value, 10); const html = buildTocHtml(selected, numberedChk.checked, depth); insertAtTop(root as HTMLElement, html); panel && panel.remove(); panel = null; };
        replaceBtn.onclick = () => { const selected = getSelected(); const depth = parseInt(depthSel.value, 10); const html = buildTocHtml(selected, numberedChk.checked, depth); replaceExistingToc(root as HTMLElement, html); panel && panel.remove(); panel = null; };
        removeBtn.onclick = () => { removeExistingToc(root as HTMLElement); panel && panel.remove(); panel = null; };
        anchorsBtn.onclick = () => { addAnchors(items); panel && panel.remove(); panel = null; };

        document.body.appendChild(panel);
    }

    // keyboard shortcut: Ctrl+Shift+T to toggle panel
    function onKeydown(e: KeyboardEvent) { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') { e.preventDefault(); panel ? (panel.remove(), panel = null) : openPanel(); } }
    document.addEventListener('keydown', onKeydown);

    // Return a cleanup function on editor destruction if available
    try {
        if (editor && editor.events && typeof editor.events.on === 'function') {
            const cleanup = () => { document.removeEventListener('keydown', onKeydown); if (panel) panel.remove(); const css = document.getElementById(CSS_ID); css && css.remove(); };
            // Hook into editor destruction if provided
            if (typeof editor.events.on === 'function' && typeof editor.events.off === 'function') {
                editor.events.on('beforeDestruct', cleanup);
            }
        }
    } catch (e) { /* ignore */ }
}

// Try to register as a Jodit plugin if global Jodit exists.
try {
    if (typeof window !== 'undefined' && (window as any).Jodit && (window as any).Jodit.plugins && typeof (window as any).Jodit.plugins.add === 'function') {
        (window as any).Jodit.plugins.add('toc', function (this: any) {
            const editorInstance = this;
            // add a command, so toolbar buttons can call it
            editorInstance.registerCommand && editorInstance.registerCommand('toc', () => { attach(editorInstance); });
            // add toolbar button via Jodit's API if available
            try {
                if (editorInstance && editorInstance.toolbar && Array.isArray(editorInstance.toolbar.buttons)) {
                    // best-effort: no-op — UI insertion is handled by attach()
                }
            } catch (e) { /* ignore */ }
            // expose attach on the plugin for explicit calls
            return { attach: () => attach(editorInstance) };
        });
    }
} catch (e) { /* ignore */ }

// Export attach fallback for manual usage
export default attach;
