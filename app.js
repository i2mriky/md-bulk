/* 2mriky Pack Bulk — كل الشغل جوه المتصفح، مفيش أي حاجة بتترفع لسيرفر */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    text: $('text'), name: $('name'), ext: $('extLabel'), stats: $('stats'), hint: $('hint'),
    files: $('files'), share: $('btnShare'), download: $('btnDownload'), copy: $('btnCopy'),
    paste: $('btnPaste'), clear: $('btnClear'), segFormat: $('segFormat'), segSplit: $('segSplit'),
    optTrim: $('optTrim'), optBlank: $('optBlank'), optInvisible: $('optInvisible'), optDate: $('optDate'),
    cleanSummary: $('cleanSummary'), toast: $('toast'),
    btnHistory: $('btnHistory'), histCount: $('histCount'), sheet: $('sheet'), backdrop: $('sheetBackdrop'),
    histList: $('histList'), histEmpty: $('histEmpty'), btnCloseSheet: $('btnCloseSheet'), btnClearHist: $('btnClearHist'),
  };

  const KEY_DRAFT = 'packbulk.draft.v1';
  const KEY_HIST = 'packbulk.history.v1';
  const KEY_OPTS = 'packbulk.opts.v1';
  const HIST_MAX = 40;

  const state = { format: 'auto', split: 'one', nameEdited: false };

  /* ---------- storage (آمن لو المتصفح قافل التخزين) ---------- */
  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  /* ---------- تنظيف النص ---------- */
  function clean(raw) {
    let t = raw.replace(/\r\n?/g, '\n');
    if (el.optInvisible.checked) t = t.replace(/[​⁠﻿­]/g, '');
    if (el.optTrim.checked) t = t.replace(/[ \t ]+$/gm, '');
    if (el.optBlank.checked) t = t.replace(/\n{3,}/g, '\n\n');
    t = t.replace(/^\s*\n/, '').replace(/\s+$/, '');
    return t ? t + '\n' : '';
  }

  /* ---------- اكتشاف Markdown ---------- */
  const MD_LINE = /^(#{1,6}\s|>\s|[-*+]\s\[[ xX]\]|```|\|.+\|\s*$)/m;
  const MD_INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/;
  const MD_LIST = /^(\s*[-*+]\s|\s*\d+\.\s)/gm;
  function looksMarkdown(t) {
    if (MD_LINE.test(t) || MD_INLINE.test(t)) return true;
    const lists = t.match(MD_LIST);
    return !!(lists && lists.length >= 3);
  }
  function currentExt(t) {
    if (state.format === 'md') return 'md';
    if (state.format === 'txt') return 'txt';
    return looksMarkdown(t) ? 'md' : 'txt';
  }

  /* ---------- التقسيم ---------- */
  const HR = /^\s*(?:-{3,}|\*{3,}|_{3,}|={3,}|—{2,})\s*$/;
  const HEAD = /^#{1,2}\s+\S/;
  function countHr(t) { return t.split('\n').filter((l) => HR.test(l)).length; }
  function countHeads(t) { return t.split('\n').filter((l) => HEAD.test(l)).length; }

  function splitParts(t) {
    if (!t) return [];
    if (state.split === 'one') return [t];
    const lines = t.split('\n');
    const parts = [];
    let cur = [];
    const push = () => { const s = cur.join('\n').trim(); if (s) parts.push(s + '\n'); cur = []; };
    for (const line of lines) {
      if (HR.test(line)) { if (state.split === 'hr') push(); continue; }
      if (state.split === 'h' && HEAD.test(line) && cur.join('').trim()) push();
      cur.push(line);
    }
    push();
    return parts.length ? parts : [t];
  }

  /* ---------- الأسماء ---------- */
  function titleFrom(t) {
    const first = (t.split('\n').find((l) => l.trim() && !HR.test(l)) || '').trim();
    let s = first
      .replace(/^#{1,6}\s+/, '').replace(/^>\s*/, '').replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, '').replace(/^\d+[.)]\s+/, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '');
    return safeName(s, 48);
  }
  function safeName(s, max = 80) {
    s = (s || '').replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
    if (s.length > max) {
      const cut = s.slice(0, max);
      const sp = cut.lastIndexOf(' ');
      s = (sp > max * 0.5 ? cut.slice(0, sp) : cut).trim();
    }
    return s;
  }
  function stamp(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function fallbackName() {
    const d = new Date(); const p = (n) => String(n).padStart(2, '0');
    return `ملاحظة ${stamp(d)} ${p(d.getHours())}${p(d.getMinutes())}`;
  }
  function baseName(t) {
    let n = safeName(el.name.value) || titleFrom(t) || fallbackName();
    if (el.optDate.checked && !n.includes(stamp())) n += ' ' + stamp();
    return n;
  }

  /* ---------- بناء الملفات ---------- */
  function build() {
    const t = clean(el.text.value);
    const ext = currentExt(t);
    const parts = splitParts(t);
    const base = baseName(t);
    const pad = String(parts.length).length < 2 ? 2 : String(parts.length).length;
    const used = new Set();
    const files = parts.map((content, i) => {
      let name = parts.length === 1 ? base : `${String(i + 1).padStart(pad, '0')} - ${titleFrom(content) || base}`;
      let final = `${name}.${ext}`; let k = 2;
      while (used.has(final.toLowerCase())) final = `${name} (${k++}).${ext}`;
      used.add(final.toLowerCase());
      return { name: final, stem: final.slice(0, -(ext.length + 1)), content, ext };
    });
    return { text: t, ext, base, files };
  }

  const enc = new TextEncoder();
  function bytesOf(f) {
    const body = enc.encode(f.content);
    if (f.ext !== 'txt') return body;
    const out = new Uint8Array(body.length + 3); // BOM عشان العربي يفتح صح في أي محرر
    out.set([0xEF, 0xBB, 0xBF]); out.set(body, 3); return out;
  }
  function toFile(f) { return new File([bytesOf(f)], f.name, { type: 'text/plain', lastModified: Date.now() }); }

  /* ---------- ZIP (store) من غير أي مكتبة ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function makeZip(entries) {
    const d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const chunks = []; const central = []; let offset = 0;
    for (const e of entries) {
      const name = enc.encode(e.name); const data = e.data; const crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      chunks.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, a) => s + a.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  /* ---------- الأفعال ---------- */
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function download(files, base) {
    if (files.length === 1) {
      saveBlob(new Blob([bytesOf(files[0])], { type: 'text/plain;charset=utf-8' }), files[0].name);
    } else {
      saveBlob(makeZip(files.map((f) => ({ name: f.name, data: bytesOf(f) }))), `${base}.zip`);
    }
  }

  async function share(files, base) {
    const objs = files.map(toFile);
    const can = navigator.canShare && navigator.share && (() => { try { return navigator.canShare({ files: objs }); } catch { return false; } })();
    if (!can) {
      download(files, base);
      toast(files.length > 1 ? 'اتنزّل ZIP — الشير مش متاح هنا' : 'اتنزّل الملف — الشير مش متاح هنا');
      return 'download';
    }
    try {
      await navigator.share({ files: objs });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancel';
      download(files, base);
      toast('الشير وقف، فنزّلته بدل كده');
      return 'download';
    }
  }

  async function runShare(onlyIndex) {
    const b = build(); if (!b.files.length) return;
    const files = onlyIndex == null ? b.files : [b.files[onlyIndex]];
    const r = await share(files, b.base);
    if (r !== 'cancel') { addHistory(b); if (r === 'shared') toast(files.length > 1 ? `${files.length} ملفات اتبعتوا` : 'اتبعت ✓'); }
  }
  function runDownload() {
    const b = build(); if (!b.files.length) return;
    download(b.files, b.base); addHistory(b);
    toast(b.files.length > 1 ? `اتنزّل ZIP فيه ${b.files.length} ملفات` : `اتنزّل ${b.files[0].name}`);
  }
  async function runCopy() {
    const t = clean(el.text.value); if (!t) return;
    try { await navigator.clipboard.writeText(t); toast('النص النضيف اتنسخ'); }
    catch { el.text.focus(); el.text.select(); toast('اختار نسخ من القايمة'); }
  }

  /* ---------- السجل ---------- */
  function history() { return store.get(KEY_HIST, []); }
  function addHistory(b) {
    let h = history().filter((x) => !(x.text === b.text && x.base === b.base));
    h.unshift({ id: Date.now(), base: b.base, ext: b.ext, n: b.files.length, text: b.text, ts: Date.now(),
      format: state.format, split: state.split, nameEdited: state.nameEdited, name: el.name.value });
    h = h.slice(0, HIST_MAX);
    while (h.length && !store.set(KEY_HIST, h)) h.pop();
    renderHistCount();
  }
  function renderHistCount() {
    const n = history().length;
    el.histCount.textContent = n; el.histCount.style.display = n ? '' : 'none';
  }
  function when(ts) {
    const d = new Date(ts); const now = new Date(); const p = (x) => String(x).padStart(2, '0');
    const hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
    if (d.toDateString() === now.toDateString()) return `النهارده ${hm}`;
    return `${d.getDate()}/${d.getMonth() + 1} ${hm}`;
  }
  function openSheet() {
    const h = history();
    el.histList.replaceChildren();
    for (const item of h) {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'hist';
      const n = document.createElement('bdi'); n.className = 'n'; n.textContent = item.base;
      const e = document.createElement('span'); e.className = 'e'; e.textContent = item.n > 1 ? `${item.n} × .${item.ext}` : `.${item.ext}`;
      const m = document.createElement('span'); m.className = 'm'; m.textContent = when(item.ts);
      row.append(n, e, m);
      row.addEventListener('click', () => restore(item));
      el.histList.appendChild(row);
    }
    el.histEmpty.style.display = h.length ? 'none' : '';
    el.btnClearHist.style.display = h.length ? '' : 'none';
    el.btnClearHist.textContent = 'امسح السجل'; el.btnClearHist.dataset.armed = '';
    el.sheet.style.display = ''; el.backdrop.style.display = '';
  }
  function closeSheet() { el.sheet.style.display = 'none'; el.backdrop.style.display = 'none'; }
  function restore(item) {
    el.text.value = item.text;
    el.name.value = item.nameEdited ? item.name : '';
    state.nameEdited = !!item.nameEdited;
    setSeg(el.segFormat, 'format', item.format || 'auto');
    setSeg(el.segSplit, 'split', item.split || 'one');
    closeSheet(); update(); saveDraft();
    toast('رجع للمحرر');
  }

  /* ---------- الواجهة ---------- */
  function setSeg(seg, key, v) {
    state[key] = v;
    for (const b of seg.querySelectorAll('button')) {
      const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
    }
  }

  function fmtSize(n) { return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`; }

  function update() {
    const raw = el.text.value;
    const has = raw.trim().length > 0;
    const b = build();

    const words = has ? (raw.trim().match(/\S+/g) || []).length : 0;
    const lines = has ? raw.replace(/\s+$/, '').split('\n').length : 0;
    el.stats.textContent = has ? `${words} كلمة · ${lines} سطر` : '';

    if (!state.nameEdited) el.name.placeholder = has ? (titleFrom(b.text) || fallbackName()) : 'اسم الملف';
    el.ext.textContent = b.files.length > 1 ? '.zip' : `.${b.ext}`;

    // الهينت
    el.hint.replaceChildren();
    if (has) {
      const add = (s, bold) => { const n = bold ? document.createElement('b') : document.createTextNode(s); if (bold) n.textContent = s; el.hint.appendChild(n); };
      if (b.files.length > 1) { add('هيطلع '); add(`${b.files.length} ملفات .${b.ext}`, true); add(' — شير مرة واحدة أو ZIP'); }
      else {
        add('هيتحفظ '); const fb = document.createElement('b'); const fn = document.createElement('bdi'); fn.className = 'fname'; fn.textContent = b.files[0].stem; const fe = document.createElement('span'); fe.className = 'fext'; fe.textContent = '.' + b.ext; fb.append(fn); el.hint.append(fb, fe);
        if (state.format === 'auto') add(b.ext === 'md' ? ' — لقيت تنسيق Markdown' : ' — نص عادي');
        if (state.split === 'one') {
          const hr = countHr(b.text), hd = countHeads(b.text);
          if (hr >= 1) add(` · فيه ${hr + 1} أجزاء بـ --- تقدر تقسّمهم`);
          else if (hd >= 2) add(` · فيه ${hd} عناوين تقدر تقسّم عندهم`);
        }
      }
    }

    // قايمة الملفات لما يتقسم
    el.files.replaceChildren();
    if (b.files.length > 1) {
      b.files.forEach((f, i) => {
        const r = document.createElement('div'); r.className = 'file';
        const n = document.createElement('bdi'); n.className = 'n'; n.textContent = f.stem; const x = document.createElement('span'); x.className = 'fext'; x.textContent = '.' + f.ext;
        const s = document.createElement('span'); s.className = 's'; s.textContent = fmtSize(enc.encode(f.content).length);
        const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'شير';
        btn.addEventListener('click', () => runShare(i));
        r.append(n, x, s, btn); el.files.appendChild(r);
      });
      el.files.style.display = '';
    } else el.files.style.display = 'none';

    const on = [el.optTrim, el.optBlank, el.optInvisible].filter((x) => x.checked).length;
    el.cleanSummary.textContent = `(${on}/3)`;

    el.share.disabled = el.download.disabled = el.copy.disabled = !has;
    el.clear.style.display = has ? '' : 'none';
    el.share.textContent = b.files.length > 1 ? `شير ${b.files.length} ملفات` : 'شير / حفظ';
  }

  let draftT;
  function saveDraft() {
    clearTimeout(draftT);
    draftT = setTimeout(() => store.set(KEY_DRAFT, { text: el.text.value, name: state.nameEdited ? el.name.value : '' }), 300);
  }
  function saveOpts() {
    store.set(KEY_OPTS, { format: state.format, split: state.split, trim: el.optTrim.checked, blank: el.optBlank.checked,
      inv: el.optInvisible.checked, date: el.optDate.checked });
  }

  let toastT;
  function toast(msg) {
    el.toast.textContent = msg; el.toast.style.display = '';
    clearTimeout(toastT); toastT = setTimeout(() => { el.toast.style.display = 'none'; }, 2200);
  }

  /* ---------- الأحداث ---------- */
  el.text.addEventListener('input', () => { update(); saveDraft(); });
  el.name.addEventListener('input', () => { state.nameEdited = el.name.value.trim().length > 0; update(); saveDraft(); });
  el.name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.name.blur(); } });

  el.segFormat.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; setSeg(el.segFormat, 'format', b.dataset.v); update(); saveOpts(); });
  el.segSplit.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; setSeg(el.segSplit, 'split', b.dataset.v); update(); saveOpts(); });
  for (const o of [el.optTrim, el.optBlank, el.optInvisible, el.optDate]) o.addEventListener('change', () => { update(); saveOpts(); });

  el.share.addEventListener('click', () => runShare());
  el.download.addEventListener('click', runDownload);
  el.copy.addEventListener('click', runCopy);

  el.paste.addEventListener('click', async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) { toast('الكليببورد فاضي'); return; }
      el.text.focus();
      const { selectionStart: s, selectionEnd: e } = el.text;
      el.text.setRangeText(t, s, e, 'end');
      update(); saveDraft();
    } catch { el.text.focus(); toast('دوس مطوّل جوه المربع واختار لصق'); }
  });

  let clearArmed = 0;
  el.clear.addEventListener('click', () => {
    if (Date.now() - clearArmed > 2500) { clearArmed = Date.now(); el.clear.textContent = 'متأكد؟'; setTimeout(() => { el.clear.textContent = 'مسح'; }, 2500); return; }
    clearArmed = 0; el.clear.textContent = 'مسح';
    el.text.value = ''; el.name.value = ''; state.nameEdited = false;
    update(); saveDraft(); el.text.focus();
  });

  el.btnHistory.addEventListener('click', openSheet);
  el.btnCloseSheet.addEventListener('click', closeSheet);
  el.backdrop.addEventListener('click', closeSheet);
  el.btnClearHist.addEventListener('click', () => {
    if (!el.btnClearHist.dataset.armed) { el.btnClearHist.dataset.armed = '1'; el.btnClearHist.textContent = 'دوس تاني للتأكيد'; return; }
    store.del(KEY_HIST); renderHistCount(); openSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.sheet.style.display !== 'none') closeSheet();
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (!el.download.disabled) runDownload(); }
    if (mod && e.key === 'Enter') { e.preventDefault(); if (!el.share.disabled) runShare(); }
  });

  // اسحب ملف نصي على المربع (للاب)
  el.text.addEventListener('dragover', (e) => e.preventDefault());
  el.text.addEventListener('drop', async (e) => {
    const fs = [...(e.dataTransfer?.files || [])].filter((f) => /\.(md|markdown|txt|text)$/i.test(f.name) || f.type.startsWith('text/'));
    if (!fs.length) return;
    e.preventDefault();
    const texts = await Promise.all(fs.map((f) => f.text()));
    el.text.value = (el.text.value.trim() ? el.text.value.replace(/\s+$/, '') + '\n\n---\n\n' : '') + texts.join('\n\n---\n\n');
    if (!state.nameEdited && fs.length === 1) { el.name.value = fs[0].name.replace(/\.[^.]+$/, ''); state.nameEdited = true; }
    update(); saveDraft(); toast(fs.length > 1 ? `${fs.length} ملفات اتضافوا` : 'الملف اتفتح');
  });

  /* ---------- البداية ---------- */
  const opts = store.get(KEY_OPTS, null);
  if (opts) {
    setSeg(el.segFormat, 'format', opts.format || 'auto');
    setSeg(el.segSplit, 'split', opts.split || 'one');
    el.optTrim.checked = opts.trim !== false; el.optBlank.checked = opts.blank !== false;
    el.optInvisible.checked = opts.inv !== false; el.optDate.checked = !!opts.date;
  }
  const draft = store.get(KEY_DRAFT, null);
  if (draft) { el.text.value = draft.text || ''; if (draft.name) { el.name.value = draft.name; state.nameEdited = true; } }
  renderHistCount(); update();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js?v=1').catch(() => {}));
  }

  // للاختبار بس
  window.__packbulk = { build, clean, makeZip, bytesOf, looksMarkdown };
})();
