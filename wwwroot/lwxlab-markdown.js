const editors = new Map();
const instanceOptions = new Map();
const linkedScrollStates = new Map();
const lineDecorationCollections = new Map();
const lineStyleElements = new Map();
const programmaticEditorUpdates = new Set();
let monacoLoaderPromise = null;
let mermaidPromise = null;
let highlightPromise = null;
let highlightCssLoaded = false;

export async function init(rootId, editorId, previewId, resizerId, dotNetRef, options) {
    const textarea = document.getElementById(editorId);
    if (!textarea) return;

    instanceOptions.set(rootId, options);
    initSearchShortcut(rootId, dotNetRef);

    if (options.enableMonaco) {
        try {
            const monaco = await loadMonaco(options.monacoLoaderUrl, options.monacoBaseUrl);
            const wrapper = document.createElement('div');
            wrapper.className = 'lwx-md-monaco';
            textarea.parentNode.insertBefore(wrapper, textarea.nextSibling);
            textarea.style.display = 'none';

            let theme = options.editor.theme || 'vs';
            if (options.theme === 'dark' && theme === 'vs') {
                theme = 'vs-dark';
            }

            const editor = monaco.editor.create(wrapper, {
                value: textarea.value || '',
                language: options.editor.language || 'markdown',
                theme: theme,
                automaticLayout: options.editor.automaticLayout !== false,
                lineNumbers: options.editor.lineNumbers || 'on',
                wordWrap: options.editor.wordWrap || 'on',
                wrappingIndent: options.editor.wrappingIndent || 'same',
                wrappingStrategy: options.editor.wrappingStrategy || 'advanced',
                scrollbar: options.editor.scrollbar || { horizontal: 'auto', alwaysConsumeMouseWheel: false },
                minimap: options.editor.minimap || { enabled: false },
                tabSize: options.editor.tabSize || 2,
                wordBasedSuggestions: options.editor.wordBasedSuggestions || 'allDocuments',
                formatOnPaste: !!options.editor.formatOnPaste,
                formatOnType: !!options.editor.formatOnType,
                renderWhitespace: options.editor.renderWhitespace || 'none',
                scrollBeyondLastLine: !!options.editor.scrollBeyondLastLine,
                stickyScroll: options.editor.stickyScroll || { enabled: false },
                fontFamily: options.editor.fontFamily,
                fontSize: options.editor.fontSize,
                readOnly: !!options.editor.readOnly
            });

            let debounce;
            editor.onDidChangeModelContent(() => {
                const value = editor.getValue();
                textarea.value = value;
                applyEditorLineStyles(rootId, editorId);
                if (programmaticEditorUpdates.has(editorId)) return;
                clearTimeout(debounce);
                debounce = setTimeout(() => dotNetRef.invokeMethodAsync('UpdateValueFromJs', value), 80);
            });

            editors.set(editorId, editor);
            applyEditorLineStyles(rootId, editorId);
            initLinkedScrolling(rootId, editorId, previewId);
        } catch (error) {
            console.warn('LwXLab.Markdown: Monaco failed, using textarea fallback.', error);
            textarea.style.display = '';
        }
    }

    initResizer(rootId, resizerId, editorId);
    initLinkedScrolling(rootId, editorId, previewId);
    await enhancePreview(previewId, options);
}

function initSearchShortcut(rootId, dotNetRef) {
    const root = document.getElementById(rootId);
    if (!root || root.dataset.lwxMdSearchReady === 'true') return;
    root.dataset.lwxMdSearchReady = 'true';
    root.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key?.toLowerCase() === 'f') {
            event.preventDefault();
            dotNetRef.invokeMethodAsync('OpenSearchFromJs');
        }
    });
}

function initResizer(rootId, resizerId, editorId) {
    const root = document.getElementById(rootId);
    if (!root || root.dataset.lwxMdResizerReady === 'true') return;
    root.dataset.lwxMdResizerReady = 'true';

    let isResizing = false;

    root.addEventListener('mousedown', (e) => {
        const resizer = e.target?.closest?.(`#${CSS.escape(resizerId)}`);
        if (!resizer || !root.contains(resizer)) return;
        isResizing = true;
        const options = instanceOptions.get(rootId);
        document.body.style.cursor = options?.splitOrientation === 'horizontal' ? 'row-resize' : 'col-resize';
        root.classList.add('lwx-md-resizing');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const options = instanceOptions.get(rootId);
        const body = root.querySelector('.lwx-md-body');
        if (!body) return;
        const bodyRect = body.getBoundingClientRect();
        const editorPane = root.querySelector('.lwx-md-editor-pane');

        if (!editorPane) return;

        if (options?.splitOrientation === 'horizontal') {
            const y = e.clientY - bodyRect.top;
            const percentage = (y / bodyRect.height) * 100;
            if (percentage > 5 && percentage < 95) {
                editorPane.style.flex = `0 0 ${percentage}%`;
                editorPane.style.height = `${percentage}%`;
                editorPane.style.width = '100%';
            }
        } else {
            const x = e.clientX - bodyRect.left;
            const percentage = (x / bodyRect.width) * 100;
            if (percentage > 5 && percentage < 95) {
                editorPane.style.flex = `0 0 ${percentage}%`;
                editorPane.style.width = `${percentage}%`;
                editorPane.style.height = '100%';
            }
        }

        const editor = editors.get(editorId);
        if (editor) editor.layout();
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            root.classList.remove('lwx-md-resizing');
        }
    });
}

function initLinkedScrolling(rootId, editorId, previewId) {
    const root = document.getElementById(rootId);
    if (!root) return;

    let state = linkedScrollStates.get(rootId);
    if (!state) {
        state = { syncing: false, editor: null, monacoDisposable: null, domReady: false };
        linkedScrollStates.set(rootId, state);
    }

    if (!state.domReady) {
        root.addEventListener('scroll', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (state.syncing) return;

            const options = instanceOptions.get(rootId);
            if (options?.viewMode !== 'split') return;

            if (target.id === previewId) {
                syncEditorScrollFromPreview(rootId, editorId, previewId, state);
            } else if (target.id === editorId) {
                syncPreviewScrollFromTextarea(rootId, editorId, previewId, state);
            }
        }, true);
        state.domReady = true;
    }

    const editor = editors.get(editorId);
    if (editor && state.editor !== editor) {
        state.monacoDisposable?.dispose?.();
        state.editor = editor;
        state.monacoDisposable = editor.onDidScrollChange(() => {
            if (state.syncing) return;
            const options = instanceOptions.get(rootId);
            if (options?.viewMode !== 'split') return;
            syncPreviewScrollFromMonaco(rootId, editorId, previewId, state);
        });
    }
}

function syncPreviewScrollFromMonaco(rootId, editorId, previewId, state) {
    const editor = editors.get(editorId);
    const preview = document.getElementById(previewId);
    if (!editor || !preview) return;

    const maxEditorScroll = Math.max(1, editor.getScrollHeight() - editor.getLayoutInfo().height);
    const ratio = clamp(editor.getScrollTop() / maxEditorScroll, 0, 1);
    setPreviewScroll(preview, ratio, state);
}

function syncPreviewScrollFromTextarea(rootId, editorId, previewId, state) {
    const textarea = document.getElementById(editorId);
    const preview = document.getElementById(previewId);
    if (!textarea || !preview) return;

    const maxTextareaScroll = Math.max(1, textarea.scrollHeight - textarea.clientHeight);
    const ratio = clamp(textarea.scrollTop / maxTextareaScroll, 0, 1);
    setPreviewScroll(preview, ratio, state);
}

function syncEditorScrollFromPreview(rootId, editorId, previewId, state) {
    const preview = document.getElementById(previewId);
    if (!preview) return;

    const maxPreviewScroll = Math.max(1, preview.scrollHeight - preview.clientHeight);
    const ratio = clamp(preview.scrollTop / maxPreviewScroll, 0, 1);
    const editor = editors.get(editorId);

    state.syncing = true;
    try {
        if (editor) {
            const maxEditorScroll = Math.max(1, editor.getScrollHeight() - editor.getLayoutInfo().height);
            editor.setScrollTop(maxEditorScroll * ratio);
        } else {
            const textarea = document.getElementById(editorId);
            if (textarea) {
                const maxTextareaScroll = Math.max(1, textarea.scrollHeight - textarea.clientHeight);
                textarea.scrollTop = maxTextareaScroll * ratio;
            }
        }
    } finally {
        requestAnimationFrame(() => { state.syncing = false; });
    }
}

function setPreviewScroll(preview, ratio, state) {
    const maxPreviewScroll = Math.max(1, preview.scrollHeight - preview.clientHeight);
    state.syncing = true;
    try {
        preview.scrollTop = maxPreviewScroll * ratio;
    } finally {
        requestAnimationFrame(() => { state.syncing = false; });
    }
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function applyEditorLineStyles(rootId, editorId) {
    const editor = editors.get(editorId);
    const config = instanceOptions.get(rootId)?.lineStyling;

    if (!editor || !config?.enabled) {
        clearEditorLineStyles(editorId);
        return;
    }

    const model = editor.getModel?.();
    if (!model || !window.monaco) return;

    const decorations = [];
    const rules = Array.isArray(config.rules) ? config.rules : [];
    const runtimeClasses = ensureEditorLineStyleSheet(editorId, rules);

    for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber++) {
        const text = model.getLineContent(lineNumber);

        for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
            const rule = rules[ruleIndex];
            if (!rule?.applyToEditor || !rule.pattern || (!rule.cssClass && !rule.cssStyle)) continue;

            let regex;
            try {
                regex = new RegExp(rule.pattern, rule.ignoreCase ? 'i' : '');
            } catch {
                continue;
            }

            const match = regex.exec(text);
            if (!match) continue;
            if (rule.matchWholeLine && (match.index !== 0 || match[0].length !== text.length)) continue;

            const wholeLineClasses = [];
            const inlineClasses = [];
            if (rule.cssClass) {
                wholeLineClasses.push(rule.cssClass);
                inlineClasses.push(`${rule.cssClass}-text`);
            }
            if (runtimeClasses[ruleIndex]) {
                wholeLineClasses.push(runtimeClasses[ruleIndex]);
                inlineClasses.push(`${runtimeClasses[ruleIndex]}-text`);
            }

            decorations.push({
                range: new window.monaco.Range(
                    lineNumber,
                    1,
                    lineNumber,
                    Math.max(1, text.length + 1)),
                options: {
                    isWholeLine: true,
                    className: wholeLineClasses.join(' '),
                    inlineClassName: inlineClasses.join(' ')
                }
            });
            break;
        }
    }

    let collection = lineDecorationCollections.get(editorId);
    if (!collection) {
        collection = editor.createDecorationsCollection();
        lineDecorationCollections.set(editorId, collection);
    }

    collection.set(decorations);
}

function ensureEditorLineStyleSheet(editorId, rules) {
    removeEditorLineStyleSheet(editorId);

    const safeEditorId = String(editorId).replace(/[^a-zA-Z0-9_-]/g, '-');
    const runtimeClasses = new Array(rules.length).fill('');
    const cssRules = [];

    for (let index = 0; index < rules.length; index++) {
        const cssStyle = rules[index]?.cssStyle?.trim();
        if (!cssStyle) continue;

        const className = `lwx-md-runtime-line-${safeEditorId}-${index}`;
        runtimeClasses[index] = className;
        cssRules.push(`.monaco-editor .${className}{${cssStyle}}`);
        cssRules.push(`.monaco-editor .${className}-text{${cssStyle}}`);
    }

    if (cssRules.length > 0) {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.dataset.lwxMarkdownEditor = editorId;
        style.textContent = cssRules.join('\n');
        document.head.appendChild(style);
        lineStyleElements.set(editorId, style);
    }

    return runtimeClasses;
}

function removeEditorLineStyleSheet(editorId) {
    const style = lineStyleElements.get(editorId);
    if (style) {
        style.remove();
        lineStyleElements.delete(editorId);
    }
}

function clearEditorLineStyles(editorId) {
    const collection = lineDecorationCollections.get(editorId);
    if (collection) {
        collection.clear();
        lineDecorationCollections.delete(editorId);
    }
    removeEditorLineStyleSheet(editorId);
}

export async function enhancePreview(previewId, options) {
    const preview = document.getElementById(previewId);
    if (!preview) return;

    if (options.enableHighlight) {
        await runHighlight(preview, options);
    }

    if (options.enableMermaid) {
        await runMermaid(preview, options);
    }
}

export function setEditorValue(editorId, value) {
    const editor = editors.get(editorId);
    if (editor && editor.getValue() !== value) {
        const position = editor.getPosition();
        programmaticEditorUpdates.add(editorId);
        try {
            editor.setValue(value || '');
            if (position) editor.setPosition(position);
        } finally {
            programmaticEditorUpdates.delete(editorId);
        }
        const root = editor.getDomNode?.()?.closest?.('.lwx-md');
        if (root?.id) applyEditorLineStyles(root.id, editorId);
        return;
    }

    const textarea = document.getElementById(editorId);
    if (textarea && textarea.value !== value) textarea.value = value || '';
}

export function insertText(editorId, text) {
    const editor = editors.get(editorId);
    if (editor) {
        const selection = editor.getSelection();
        editor.executeEdits('lwx-md-toolbar', [{ range: selection, text: text || '', forceMoveMarkers: true }]);
        editor.focus();
        return;
    }

    const textarea = document.getElementById(editorId);
    if (!textarea) return;

    const start = textarea.selectionStart || textarea.value.length;
    const end = textarea.selectionEnd || textarea.value.length;
    textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
}

export function insertToolbarText(editorId, before, placeholder, after) {
    before = before || '';
    placeholder = placeholder || '';
    after = after || '';

    const editor = editors.get(editorId);
    if (editor) {
        const selection = editor.getSelection();
        const model = editor.getModel();
        const selectedText = selection && model ? model.getValueInRange(selection) : '';
        const body = selectedText || placeholder;
        const text = `${before}${body}${after}`;

        editor.executeEdits('lwx-md-toolbar', [{ range: selection, text, forceMoveMarkers: true }]);
        const position = selection?.getStartPosition?.();
        if (position) {
            const offset = model.getOffsetAt(position) + text.length;
            editor.setPosition(model.getPositionAt(offset));
            editor.setSelection({
                startLineNumber: editor.getPosition().lineNumber,
                startColumn: editor.getPosition().column,
                endLineNumber: editor.getPosition().lineNumber,
                endColumn: editor.getPosition().column
            });
        }
        editor.focus();
        return;
    }

    const textarea = document.getElementById(editorId);
    if (!textarea) return;

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const selectedText = textarea.value.substring(start, end);
    const body = selectedText || placeholder;
    const text = `${before}${body}${after}`;
    textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
    const cursor = start + text.length;
    textarea.selectionStart = cursor;
    textarea.selectionEnd = cursor;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
}

export function saveAutoSave(id, value) {
    if (!id) return;
    window.localStorage.setItem(`lwx-md-autosave:${id}`, value || '');
}

export function restoreAutoSave(id) {
    if (!id) return null;
    return window.localStorage.getItem(`lwx-md-autosave:${id}`);
}

export function clearAutoSave(id) {
    if (!id) return;
    window.localStorage.removeItem(`lwx-md-autosave:${id}`);
}

export function layoutEditor(editorId) {
    const editor = editors.get(editorId);
    if (editor) {
        setTimeout(() => editor.layout(), 0);
    }
}

export function focusFindInput(rootId) {
    const root = document.getElementById(rootId);
    const input = root?.querySelector?.('.lwx-md-findbar input');
    if (input) {
        setTimeout(() => {
            input.focus();
            input.select?.();
        }, 0);
    }
}

export function selectTextRange(editorId, start, length) {
    const editor = editors.get(editorId);
    if (editor) {
        const model = editor.getModel();
        if (!model) return;
        const startPosition = model.getPositionAt(Math.max(0, start || 0));
        const endPosition = model.getPositionAt(Math.max(0, (start || 0) + (length || 0)));
        const range = {
            startLineNumber: startPosition.lineNumber,
            startColumn: startPosition.column,
            endLineNumber: endPosition.lineNumber,
            endColumn: endPosition.column
        };
        editor.setSelection(range);
        editor.revealRangeInCenter(range);
        editor.focus();
        return;
    }

    const textarea = document.getElementById(editorId);
    if (!textarea) return;
    const safeStart = Math.max(0, start || 0);
    const safeEnd = Math.max(safeStart, safeStart + (length || 0));
    textarea.focus();
    textarea.setSelectionRange(safeStart, safeEnd);
}

export function updateOptions(rootId, editorId, options) {
    instanceOptions.set(rootId, options);
    const root = document.getElementById(rootId);
    if (root) {
        const resizer = root.querySelector('.lwx-md-resizer');
        if (resizer) initResizer(rootId, resizer.id, editorId);
        const preview = root.querySelector('.lwx-md-preview');
        if (preview) initLinkedScrolling(rootId, editorId, preview.id);
    }
    const editor = editors.get(editorId);
    if (editor && options.enableMonaco) {
        let theme = options.editor.theme || 'vs';
        if (options.theme === 'dark' && theme === 'vs') {
            theme = 'vs-dark';
        }
        window.monaco.editor.setTheme(theme);
        editor.updateOptions({
            automaticLayout: options.editor.automaticLayout !== false,
            lineNumbers: options.editor.lineNumbers || 'on',
            wordWrap: options.editor.wordWrap || 'on',
            wrappingIndent: options.editor.wrappingIndent || 'same',
            wrappingStrategy: options.editor.wrappingStrategy || 'advanced',
            scrollbar: options.editor.scrollbar || { horizontal: 'auto', alwaysConsumeMouseWheel: false },
            minimap: options.editor.minimap || { enabled: false },
            tabSize: options.editor.tabSize || 2,
            wordBasedSuggestions: options.editor.wordBasedSuggestions || 'allDocuments',
            formatOnPaste: !!options.editor.formatOnPaste,
            formatOnType: !!options.editor.formatOnType,
            renderWhitespace: options.editor.renderWhitespace || 'none',
            scrollBeyondLastLine: !!options.editor.scrollBeyondLastLine,
            stickyScroll: options.editor.stickyScroll || { enabled: false },
            fontFamily: options.editor.fontFamily,
            fontSize: options.editor.fontSize,
            readOnly: !!options.editor.readOnly
        });
        const model = editor.getModel?.();
        if (model && options.editor.language && window.monaco?.editor?.setModelLanguage) {
            window.monaco.editor.setModelLanguage(model, options.editor.language);
        }
        setTimeout(() => editor.layout(), 0);
    }

    applyEditorLineStyles(rootId, editorId);
}

export function dispose(editorId) {
    programmaticEditorUpdates.delete(editorId);
    clearEditorLineStyles(editorId);
    const editor = editors.get(editorId);
    if (editor) {
        editor.dispose();
        editors.delete(editorId);
    }
    for (const [rootId, state] of linkedScrollStates) {
        if (state.editor === editor) {
            state.monacoDisposable?.dispose?.();
            linkedScrollStates.delete(rootId);
        }
    }
}

async function loadMonaco(loaderUrl, baseUrl) {
    if (window.monaco) return window.monaco;

    if (!monacoLoaderPromise) {
        monacoLoaderPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-lwx-monaco-loader]');
            if (existing) {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = loaderUrl;
            script.async = true;
            script.dataset.lwxMonacoLoader = 'true';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        }).then(() => new Promise((resolve) => {
            window.require.config({ paths: { vs: baseUrl } });
            window.require(['vs/editor/editor.main'], () => resolve(window.monaco));
        }));
    }

    return monacoLoaderPromise;
}

async function runMermaid(preview, options) {
    const blocks = Array.from(preview.querySelectorAll('pre > code.language-mermaid, pre > code.lang-mermaid'));
    if (blocks.length === 0) return;

    const mermaid = await loadMermaid(options.mermaidUrl);
    const theme = options.theme === 'dark' ? 'dark' : 'default';
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme });

    for (const code of blocks) {
        const source = code.textContent || '';
        const container = document.createElement('div');
        container.className = 'mermaid';
        container.textContent = source;
        code.parentElement.replaceWith(container);
    }

    await mermaid.run({ nodes: preview.querySelectorAll('.mermaid') });
}

async function loadMermaid(url) {
    if (!mermaidPromise) {
        mermaidPromise = import(/* @vite-ignore */ url).then(m => m.default || m);
    }

    return mermaidPromise;
}

async function runHighlight(preview, options) {
    try {
        if (!highlightCssLoaded && options.highlightThemeUrl) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = options.highlightThemeUrl;
            link.dataset.lwxHighlightTheme = 'true';
            document.head.appendChild(link);
            highlightCssLoaded = true;
        }

        const hljs = await loadHighlight(options.highlightUrl);
        preview.querySelectorAll('pre code:not(.language-mermaid):not(.lang-mermaid)').forEach(block => {
            if (block.dataset.highlighted === 'yes') return;
            if (block.classList.contains('language-razor') || block.classList.contains('lang-razor')) {
                block.classList.remove('language-razor', 'lang-razor');
                block.classList.add('language-csharp');
            }
            try { hljs.highlightElement(block); } catch { }
        });
    } catch (error) {
        console.warn('LwXLab.Markdown: highlight.js unavailable.', error);
    }
}

async function loadHighlight(url) {
    if (!highlightPromise) {
        highlightPromise = import(/* @vite-ignore */ url).then(m => m.default || m);
    }

    return highlightPromise;
}
