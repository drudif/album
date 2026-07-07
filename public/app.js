// ====== Estado global ======
const state = {
  user: null,        // usuario logado
  catalog: null,     // { sections, total }
  byCode: new Map(), // code -> sticker
  edit: new Map(),   // code -> 'missing' | 'duplicate' (rascunho do editor)
  dirty: false,
};

const $ = (sel, el = document) => el.querySelector(sel);
const app = $('#app');

// ====== API helper ======
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro inesperado.');
  return data;
}

// ====== Toast ======
let toastT;
function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add('hidden'), 2600);
}

// ====== Utils ======
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Linha de crédito ("powered by … · made by <autor> · reporte bugs") a partir do content.js
function creditHtml() {
  const c = C.meta.credit;
  return `${esc(c.prefix)}<a href="${esc(c.authorUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.authorName)}</a> · <a href="#" class="report-bugs">${esc(c.reportBugs)}</a>`;
}

// Aplica marca/título (aba do navegador + cabeçalho) a partir do content.js
function applyMeta() {
  document.title = C.meta.pageTitle;
  const brand = document.querySelector('.brand strong');
  if (brand) { brand.textContent = C.meta.headerTitle; brand.setAttribute('data-text', C.meta.headerTitle); }
  const hc = document.querySelector('.topbar .credit');
  if (hc) hc.innerHTML = creditHtml();
  const nav = C.nav;
  const setNav = (v, t) => { const b = document.querySelector(`#nav button[data-view="${v}"]`); if (b) b.textContent = t; };
  setNav('profile', nav.profile); setNav('friends', nav.friends);
  setNav('groups', nav.groups); setNav('matches', nav.matches);
  setNav('admin', nav.admin);
  const out = document.querySelector('#logoutBtn'); if (out) out.textContent = nav.logout;
}

// ====== Catalogo ======
async function loadCatalog() {
  if (state.catalog) return;
  state.catalog = await api('/api/catalog');
  for (const sec of state.catalog.sections)
    for (const s of sec.stickers) state.byCode.set(s.code, s);
}

// ====== Navegacao ======
function setActiveNav(view) {
  document.querySelectorAll('#nav button[data-view]').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === view)
  );
}

async function go(view, arg) {
  if (state.dirty && view !== 'profile') {
    if (!confirm(C.profile.unsavedLeave)) return;
    state.dirty = false;
  }
  setActiveNav(view);
  if (view === 'profile') return renderProfile();
  if (view === 'friends') return renderFriends();
  if (view === 'groups') return renderGroups();
  if (view === 'group') return renderGroup(arg);
  if (view === 'matches') return renderMatches();
  if (view === 'admin') return renderAdmin();
  if (view === 'person') return renderPerson(arg);
}

// ====== Tela de login / cadastro ======
async function renderAuth() {
  $('#nav').classList.add('hidden');
  document.body.classList.remove('logged-in'); // cursor custom volta só na home
  let cfg = { turnstileSiteKey: '' };
  try { cfg = await api('/api/config'); } catch (e) { /* segue sem */ }

  const h = C.home;
  const marq = h.marquee.map((s) => `<span>${esc(s)}</span>`).join('');

  // Se a pessoa chegou por um link de convite, mostra uma faixa personalizada.
  let bannerHtml = '';
  const inv = getPendingInvite();
  if (inv) {
    try {
      const info = await fetchInvite(inv);
      bannerHtml = inv.kind === 'group'
        ? `<div class="invite-banner">${h.inviteBannerGroup(esc(info.group.ownerName), esc(info.group.name))}</div>`
        : `<div class="invite-banner">${h.inviteBannerFriend(esc(info.inviter.name))}</div>`;
    } catch (e) { clearPendingInvite(); /* convite inválido: segue sem faixa */ }
  }

  app.innerHTML = `
    ${bannerHtml}
    <div class="auth-grid">
    <div class="hero">
      <span class="sticker-badge">${esc(h.badge)}</span>
      <h1 class="glitch" data-text="${esc(h.titleFull)}">${esc(h.titleLine1)}<br/>${esc(h.titleLine2)}</h1>
      <p>${esc(h.description)}</p>
      <div class="credit">${creditHtml()}</div>
      <div class="marquee" aria-hidden="true"><div>${marq}${marq}</div></div>
    </div>
    <div class="card auth-card">
      <div class="tabs">
        <button id="tabReg" class="active">${esc(h.tabRegister)}</button>
        <button id="tabLogin">${esc(h.tabLogin)}</button>
      </div>
      <form id="authForm">
        <div class="field" id="nameField">
          <label>${esc(h.nameLabel)}</label>
          <input name="name" placeholder="${esc(h.namePlaceholder)}" autocomplete="name" />
        </div>
        <div class="field">
          <label>${esc(h.emailLabel)}</label>
          <input name="email" type="email" placeholder="${esc(h.emailPlaceholder)}" autocomplete="email" />
        </div>
        <div class="field">
          <label>${esc(h.passwordLabel)}</label>
          <input name="password" type="password" placeholder="${esc(h.passwordPlaceholder)}" autocomplete="current-password" />
        </div>
        <label class="check" id="ageField">
          <input name="age" type="checkbox" />
          <span>${h.ageText}</span>
        </label>
        <div id="tsWidget" class="ts-widget"></div>
        <button type="submit" style="width:100%">${esc(h.submit)}</button>
      </form>
      ${cfg.googleEnabled ? `
      <div class="orsep"><span>${esc(h.orSeparator)}</span></div>
      <a class="gbtn" href="/api/auth/google"><span class="gico">G</span> ${esc(h.googleButton)}</a>
      <div class="oauth-note">${esc(h.googleNote)}</div>` : ''}
    </div>
    </div>`;

  let mode = 'register';
  const setMode = (m) => {
    mode = m;
    $('#tabReg').classList.toggle('active', m === 'register');
    $('#tabLogin').classList.toggle('active', m === 'login');
    $('#nameField').classList.toggle('hidden', m === 'login');
    $('#ageField').classList.toggle('hidden', m === 'login');
    const pw = document.querySelector('input[name="password"]');
    if (pw) pw.setAttribute('autocomplete', m === 'register' ? 'new-password' : 'current-password');
  };
  $('#tabReg').onclick = () => setMode('register');
  $('#tabLogin').onclick = () => setMode('login');

  // Cloudflare Turnstile (humano/bot)
  let tsToken = '';
  let tsId = null;
  const mountTurnstile = () => {
    if (tsId !== null || !window.turnstile || !cfg.turnstileSiteKey) return;
    tsId = window.turnstile.render('#tsWidget', {
      sitekey: cfg.turnstileSiteKey,
      callback: (t) => { tsToken = t; },
      'error-callback': () => { tsToken = ''; },
      'expired-callback': () => { tsToken = ''; },
    });
  };
  (function waitTs() {
    if (window.turnstile && window.turnstile.render) mountTurnstile();
    else setTimeout(waitTs, 200);
  })();

  $('#authForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    if (cfg.turnstileSiteKey && !tsToken) { toast(C.home.humanCheck, true); return; }
    try {
      let data;
      if (mode === 'register') {
        data = await api('/api/register', {
          method: 'POST',
          body: {
            name: f.name.value, email: f.email.value, password: f.password.value,
            ageConfirmed: f.age.checked, turnstileToken: tsToken,
          },
        });
        toast(C.home.accountCreated);
      } else {
        data = await api('/api/login', {
          method: 'POST',
          body: { email: f.email.value, password: f.password.value, turnstileToken: tsToken },
        });
        toast(C.home.welcomeBack);
      }
      state.user = data.user;
      await boot();
    } catch (err) {
      toast(err.message, true);
      if (tsId !== null && window.turnstile) { window.turnstile.reset(tsId); tsToken = ''; }
    }
  };
}

// ====== Meu album (editor) ======
async function renderProfile() {
  const P = C.profile;
  app.innerHTML = `<div class="empty">${esc(P.loading)}</div>`;
  await loadCatalog();
  const data = await api(`/api/users/${state.user.id}`);

  // Inicializa rascunho a partir do servidor.
  state.edit = new Map();
  for (const s of data.missing) state.edit.set(s.code, 'missing');
  for (const s of data.duplicates) state.edit.set(s.code, 'duplicate');
  state.dirty = false;

  app.innerHTML = `
    <div class="card">
      <h2>${esc(P.title)}</h2>
      <div class="profile-top">
        <div class="profile-lead">
          <div class="sub">${P.sub}</div>
          <div class="stats" id="profileStats"></div>
          <div class="legend">
            <span><span class="dot get"></span>${esc(P.legendMissing)}</span>
            <span><span class="dot give"></span>${esc(P.legendDuplicate)}</span>
          </div>
          <div class="editor-toolbar">
            <input id="filterInput" placeholder="${esc(P.filterPlaceholder)}" />
            <button class="sec" id="exportBtn">${esc(P.exportBtn)}</button>
          </div>
        </div>
        <aside class="next-steps">
          <h3>${esc(P.nextTitle)}</h3>
          <div class="ns-item">
            <b>${esc(P.nextInviteLabel)}</b>
            <span>${esc(P.nextInviteDesc)}</span>
            <button class="ns-link" data-go="friends">${esc(P.nextInviteLink)} →</button>
          </div>
          <div class="ns-item">
            <b>${esc(P.nextGroupLabel)}</b>
            <span>${esc(P.nextGroupDesc)}</span>
            <button class="ns-link" data-go="groups">${esc(P.nextGroupLink)} →</button>
          </div>
        </aside>
      </div>
      <div id="sections"></div>
      <div class="savebar">
        <span class="muted" id="dirtyHint"></span>
        <button class="ghost" id="resetBtn">${esc(P.undo)}</button>
        <button id="saveBtn">${esc(P.save)}</button>
      </div>
    </div>`;

  renderSections('');
  updateProfileStats();

  $('#filterInput').oninput = (e) => renderSections(e.target.value.trim().toLowerCase());
  $('#saveBtn').onclick = saveAlbum;
  $('#resetBtn').onclick = () => renderProfile();
  $('#exportBtn').onclick = exportCard;
  app.querySelectorAll('.ns-link[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));
}

function updateProfileStats() {
  let miss = 0, dup = 0;
  for (const v of state.edit.values()) v === 'missing' ? miss++ : dup++;
  const have = state.catalog.total - miss; // estimativa: o que nao falta
  $('#profileStats').innerHTML = `
    <div class="stat"><b>${state.catalog.total}</b><span>${esc(C.profile.statTotal)}</span></div>
    <div class="stat"><b style="color:var(--get)">${miss}</b><span>${esc(C.profile.statMissing)}</span></div>
    <div class="stat"><b style="color:var(--give)">${dup}</b><span>${esc(C.profile.statDuplicates)}</span></div>`;
  const hint = $('#dirtyHint');
  if (hint) hint.textContent = state.dirty ? C.profile.dirtyUnsaved : C.profile.dirtySaved;
}

function renderSections(filter) {
  const wrap = $('#sections');
  const sections = state.catalog.sections;
  let html = '';
  let lastGroup = null;
  for (const sec of sections) {
    const matches = sec.stickers.filter(
      (s) =>
        !filter ||
        s.code.toLowerCase().includes(filter) ||
        s.label.toLowerCase().includes(filter) ||
        sec.title.toLowerCase().includes(filter)
    );
    if (matches.length === 0) continue;
    // Cabecalho de grupo da Copa (so para selecoes), antes da 1a visivel do grupo.
    if (sec.group && sec.group !== lastGroup) {
      html += `<div class="group-head">${esc(C.profile.groupHead(sec.group))}</div>`;
      lastGroup = sec.group;
    }
    const open = filter ? 'open' : '';
    let selCount = 0;
    for (const s of sec.stickers) if (state.edit.has(s.code)) selCount++;

    // Reproducao da pagina do album: spread de duas paginas (4 colunas cada),
    // com posicoes fixas por numero — escudo(01) no topo, elenco(13) etc.
    // [linha, coluna] dentro de cada pagina (esquerda 1-10, direita 11-20).
    const numOf = (code) => { const m = /(\d+)$/.exec(code); return m ? Number(m[1]) : 0; };
    const POS = {
      1: [1, 3], 2: [1, 4],
      3: [2, 1], 4: [2, 2], 5: [2, 3], 6: [2, 4],
      7: [3, 1], 8: [3, 2], 9: [3, 3], 10: [3, 4],
      11: [1, 1], 12: [1, 2], 13: [1, 4],
      14: [2, 1], 15: [2, 2], 16: [2, 3], 17: [2, 4],
      18: [3, 2], 19: [3, 3], 20: [3, 4],
    };
    let body;
    if (sec.group && !filter) {
      const left = matches.filter((s) => numOf(s.code) <= 10);
      const right = matches.filter((s) => numOf(s.code) > 10);
      const cell = (s) => { const p = POS[numOf(s.code)]; return stickerRow(s, p ? { r: p[0], c: p[1] } : null); };
      body = `<div class="album-spread">
          <div class="album-pg">${left.map(cell).join('')}</div>
          <div class="album-pg">${right.map(cell).join('')}</div>
        </div>`;
    } else {
      // Filtro ativo ou secao especial: grade simples em fluxo.
      body = `<div class="grid">${matches.map((s) => stickerRow(s)).join('')}</div>`;
    }

    html += `
      <details class="section" ${open}>
        <summary>
          <span class="flag">${sec.flag || '⚽'}</span>
          <span class="title">${esc(sec.title)}</span>
          <span class="count">${esc(C.profile.sectionCount(selCount, matches.length))}</span>
        </summary>
        ${body}
      </details>`;
  }
  wrap.innerHTML = html || `<div class="empty">${esc(C.profile.emptyFilter)}</div>`;

  wrap.querySelectorAll('.toggles button').forEach((btn) => {
    btn.onclick = () => toggleSticker(btn.dataset.code, btn.dataset.kind);
  });
}

// Icones minimalistas (mesmo estilo de traco do app) por tipo de figurinha.
const STICKER_ICONS = {
  bust: '<circle cx="12" cy="8.2" r="3.4"/><path d="M5.5 19c0-3.7 2.9-6.2 6.5-6.2s6.5 2.5 6.5 6.2"/>',
  group:
    '<circle cx="8" cy="8.6" r="2.4"/><circle cx="16" cy="8.6" r="2.4"/><path d="M3.4 17.6c0-2.7 2-4.4 4.6-4.4 1 0 1.9.25 2.6.7"/><path d="M13.4 18.6c.2-3 2.4-5 4.6-5s4 1.7 4.6 4.6"/>',
  crest:
    '<path d="M12 3.2l7 2.1v5.2c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V5.3l7-2.1z"/><path d="M9 11l2 2 4-4"/>',
  star: '<path d="M12 3.4l2.5 5.3 5.8.8-4.2 4 1 5.8L12 16.6l-5.1 2.7 1-5.8-4.2-4 5.8-.8L12 3.4z"/>',
};
function stickerIcon(s, num) {
  let type = 'bust';
  let shine = false;
  if (s.sectionId === 'LEG') { type = 'bust'; shine = true; } // craques: jogador com brilho
  else if (s.sectionId === 'FWC') { type = 'star'; shine = true; }
  else if (s.sectionId === 'CC') { type = 'bust'; }
  else if (s.team) {
    if (num === 1) { type = 'crest'; shine = true; }
    else if (num === 13) { type = 'group'; }
    else { type = 'bust'; }
  }
  const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${STICKER_ICONS[type]}</svg>`;
  return { svg, shine };
}

function stickerRow(s, pos) {
  const status = state.edit.get(s.code);
  const cls = status === 'missing' ? 'is-miss' : status === 'duplicate' ? 'is-dup' : '';
  // Quebra o codigo em prefixo + numero (ex.: BRA07 -> BRA / 7), estilo album.
  const m = /^([A-Za-z]+)(\d+)$/.exec(s.code);
  const prefix = m ? m[1] : s.code;
  const numN = m ? Number(m[2]) : 0;
  const num = m ? String(numN) : '';
  const ic = stickerIcon(s, numN);
  // Posicao fixa na pagina do album (linha/coluna), quando fornecida.
  const style = pos ? ` style="grid-row:${pos.r};grid-column:${pos.c}"` : '';
  return `
    <div class="sticker ${cls}" data-code="${s.code}"${style}>
      <span class="slot-num"><i>${prefix}</i><b>${num}</b></span>
      <span class="slot-ph${ic.shine ? ' shine' : ''}" aria-hidden="true">${ic.svg}</span>
      <span class="toggles">
        <button class="miss ${status === 'missing' ? 'on' : ''}" data-code="${s.code}" data-kind="missing" title="${esc(C.profile.stickerMissing)}">${esc(C.profile.stickerMissing)}</button>
        <button class="dup ${status === 'duplicate' ? 'on' : ''}" data-code="${s.code}" data-kind="duplicate" title="${esc(C.profile.legendDuplicate)}">${esc(C.profile.stickerDuplicate)}</button>
      </span>
    </div>`;
}

function toggleSticker(code, kind) {
  const cur = state.edit.get(code);
  if (cur === kind) state.edit.delete(code);
  else state.edit.set(code, kind);
  state.dirty = true;

  // Atualiza so a linha afetada.
  const row = document.querySelector(`.sticker[data-code="${code}"]`);
  if (row) {
    const status = state.edit.get(code);
    row.classList.toggle('is-miss', status === 'missing');
    row.classList.toggle('is-dup', status === 'duplicate');
    row.querySelector('.miss').classList.toggle('on', status === 'missing');
    row.querySelector('.dup').classList.toggle('on', status === 'duplicate');
  }
  updateProfileStats();
}

async function saveAlbum() {
  const missing = [], duplicates = [];
  for (const [code, st] of state.edit) (st === 'missing' ? missing : duplicates).push(code);
  try {
    await api(`/api/users/${state.user.id}/stickers`, {
      method: 'PUT',
      body: { missing, duplicates },
    });
    state.dirty = false;
    updateProfileStats();
    toast(C.profile.saved);
  } catch (err) {
    toast(err.message, true);
  }
}

// ====== Exportar card (imagem compartilhavel) ======
// Gera um PNG resumido com as listas de faltantes e repetidas, no estilo
// Neo-Brutalist, e dispara o compartilhamento (Web Share API) ou download.
async function exportCard() {
  const miss = [], dup = [];
  for (const [code, st] of state.edit) (st === 'missing' ? miss : dup).push(code);
  miss.sort((a, b) => a.localeCompare(b));
  dup.sort((a, b) => a.localeCompare(b));

  const INK = '#09090b', PAPER = '#f8f4e8', ACID = '#2dd4bf', MUT = '#5c5c52';
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // garante as fontes do app carregadas antes de desenhar (Bricolage p/ display)
  try {
    await Promise.all([
      document.fonts.load('800 92px "Bricolage Grotesque"'),
      document.fonts.load('800 64px "Bricolage Grotesque"'),
      document.fonts.load('700 28px "Space Grotesk"'),
      document.fonts.load('500 26px "Space Grotesk"'),
    ]);
    await document.fonts.ready;
  } catch (e) { /* usa fallback */ }

  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  const block = (x, y, w, h, r, fill) => {
    ctx.fillStyle = INK; rr(x + 7, y + 7, w, h, r); ctx.fill();          // sombra dura
    ctx.fillStyle = fill; ctx.lineWidth = 4; ctx.strokeStyle = INK;
    rr(x, y, w, h, r); ctx.fill(); ctx.stroke();
  };

  // fundo + moldura
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.strokeRect(22, 22, W - 44, H - 44);

  const M = 70;
  const X = C.exportCard;
  // badge
  block(M, 64, 430, 54, 27, ACID);
  ctx.fillStyle = INK; ctx.font = '700 22px "Space Grotesk"'; ctx.textBaseline = 'middle';
  ctx.fillText(X.badge, M + 24, 64 + 29);

  // titulo
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = INK; ctx.font = '800 92px "Bricolage Grotesque"';
  ctx.fillText(X.titleLine1, M, 232);
  ctx.fillText(X.titleLine2, M, 232 + 90);

  // usuario
  ctx.font = '700 30px "Space Grotesk"';
  ctx.fillText(`${(state.user.name || '').toUpperCase()}`, M, 232 + 90 + 56);

  // caixas de contagem
  const boxW = (W - M * 2 - 24) / 2, boxY = 470, boxH = 130;
  block(M, boxY, boxW, boxH, 12, ACID);
  block(M + boxW + 24, boxY, boxW, boxH, 12, INK);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK; ctx.font = '800 64px "Bricolage Grotesque"';
  ctx.fillText(String(miss.length), M + 26, boxY + 78);
  ctx.font = '700 22px "Space Grotesk"'; ctx.fillStyle = INK;
  ctx.fillText(X.boxMissing, M + 26, boxY + 108);
  ctx.fillStyle = ACID; ctx.font = '800 64px "Bricolage Grotesque"';
  ctx.fillText(String(dup.length), M + boxW + 24 + 26, boxY + 78);
  ctx.font = '700 22px "Space Grotesk"';
  ctx.fillText(X.boxDuplicates, M + boxW + 24 + 26, boxY + 108);

  // desenha lista de codigos em "chips", com truncamento por linhas
  const drawCodes = (codes, x, y, maxW, maxRows, fill, txt) => {
    ctx.font = '700 24px "Space Grotesk"';
    const padX = 13, h = 40, gap = 9, lh = h + gap;
    let cx = x, row = 0;
    const drawChip = (t, w, isMore) => {
      ctx.fillStyle = INK; rr(cx + 4, y + 4, w, h, 6); ctx.fill();
      ctx.fillStyle = isMore ? PAPER : fill; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      rr(cx, y, w, h, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = isMore ? INK : txt; ctx.textBaseline = 'middle';
      ctx.fillText(t, cx + padX, y + h / 2 + 1);
    };
    if (!codes.length) {
      ctx.fillStyle = MUT; ctx.font = '500 24px "Space Grotesk"'; ctx.textBaseline = 'middle';
      ctx.fillText(X.nothingMarked, x, y + h / 2);
      return;
    }
    for (let i = 0; i < codes.length; i++) {
      const t = codes[i];
      const w = Math.ceil(ctx.measureText(t).width) + padX * 2;
      if (cx + w > x + maxW) { cx = x; row++; y += lh; }
      if (row >= maxRows) {
        const more = `+${codes.length - i}`;
        const mw = Math.ceil(ctx.measureText(more).width) + padX * 2;
        cx = x + maxW - mw; y -= lh; // volta pra ultima linha visivel
        drawChip(more, mw, true);
        return;
      }
      drawChip(t, w, false);
      cx += w + gap;
    }
  };

  const contentW = W - M * 2;
  ctx.fillStyle = INK; ctx.font = '700 24px "Space Grotesk"'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(X.listMissing, M, 658);
  drawCodes(miss, M, 680, contentW, 4, ACID, INK);

  ctx.fillStyle = INK; ctx.font = '700 24px "Space Grotesk"'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(X.listDuplicates, M, 968);
  drawCodes(dup, M, 990, contentW, 4, INK, ACID);

  // rodape
  ctx.fillStyle = INK; ctx.fillRect(22, H - 96, W - 44, 2);
  ctx.fillStyle = MUT; ctx.font = '500 22px "Space Grotesk"'; ctx.textBaseline = 'middle';
  ctx.fillText(X.footer, M, H - 58);

  // abre o modal com a imagem + o texto pronto pra copiar (WhatsApp)
  openWhatsappModal(cv, buildWhatsappText());
}

// Monta o texto (WhatsApp) das faltantes e repetidas, agrupado por seleção
// com o emoji da bandeira de cada uma.
function buildWhatsappText() {
  const W = C.whatsapp;
  const missLines = [], dupLines = [];
  let missCount = 0, dupCount = 0;
  for (const sec of state.catalog.sections) {
    const flag = sec.flag || '⚽';
    const miss = [], dup = [];
    for (const s of sec.stickers) {
      const st = state.edit.get(s.code);
      if (st === 'missing') miss.push(s.code);
      else if (st === 'duplicate') dup.push(s.code);
    }
    if (miss.length) { missLines.push(`${flag} ${miss.join(', ')}`); missCount += miss.length; }
    if (dup.length) { dupLines.push(`${flag} ${dup.join(', ')}`); dupCount += dup.length; }
  }
  const lines = [W.textHeader];
  if (state.user && state.user.name) lines.push(state.user.name);
  lines.push('', W.textMissing(missCount), missCount ? missLines.join('\n') : W.textNothingMissing);
  lines.push('', W.textDuplicates(dupCount), dupCount ? dupLines.join('\n') : W.textNothingDup);
  lines.push('', W.textFooter(location.origin));
  return lines.join('\n');
}

// Modal da "Versão WhatsApp": prévia da imagem + texto copiável + baixar/compartilhar.
function openWhatsappModal(cv, text) {
  const W = C.whatsapp, X = C.exportCard;
  const wrap = document.createElement('div');
  wrap.className = 'lightbox';
  wrap.innerHTML = `
    <div class="lb-card wa-card">
      <h2>${esc(W.title)}</h2>
      <div class="sub">${esc(W.sub)}</div>
      <div class="wa-grid">
        <div class="wa-imgcol">
          <img class="wa-img" alt="prévia do card" src="${cv.toDataURL('image/png')}" />
          <button type="button" id="waImg" class="wa-dl">${esc(W.downloadImg)}</button>
        </div>
        <div class="wa-textwrap">
          <textarea id="waText" rows="12" readonly>${esc(text)}</textarea>
          <button id="waCopy" class="ns-link" type="button">${esc(W.copyText)}</button>
        </div>
      </div>
      <div class="lb-actions">
        <button class="ghost" type="button" id="waClose">${esc(W.close)}</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  wrap.querySelector('#waClose').onclick = close;
  wrap.querySelector('#waCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch { const t = wrap.querySelector('#waText'); t.select(); document.execCommand('copy'); }
    toast(W.copied);
  };
  wrap.querySelector('#waImg').onclick = () => {
    cv.toBlob(async (blob) => {
      if (!blob) { toast(X.genError, true); return; }
      const file = new File([blob], X.fileName, { type: 'image/png' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: X.shareTitle, text: X.shareText });
          return;
        }
      } catch (e) { /* cai pro download */ }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = X.fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(X.done);
    }, 'image/png');
  };
}

// ====== Amigos (convite por link + aceite) ======
async function renderFriends() {
  const F = C.friends;
  app.innerHTML = `<div class="empty">${esc(F.loading)}</div>`;
  const [link, data] = await Promise.all([
    api('/api/friends/link').catch(() => ({ url: '' })),
    api('/api/friends'),
  ]);
  let inviteUrl = link.url;
  const friends = data.friends;
  app.innerHTML = `
    <div class="card">
      <h2>${esc(F.inviteTitle)}</h2>
      <div class="sub">${F.inviteSub}</div>
      <div class="row">
        <input id="inviteUrl" readonly value="${esc(inviteUrl)}" />
        <button id="copyInvite" style="flex:none">${esc(F.copyLink)}</button>
        <button id="rotateInvite" class="ghost" style="flex:none" title="${esc(F.newLinkTitle)}">${esc(F.newLink)}</button>
      </div>
      <div class="row" style="margin-top:10px">
        <button id="shareInvite" class="sec" style="flex:none">${esc(C.share.friendBtn)}</button>
      </div>
    </div>
    <div class="card">
      <h2>${esc(F.listTitle)} <span style="color:var(--muted);font-weight:400">(${friends.length})</span></h2>
      ${friends.length === 0
        ? `<div class="empty"><div class="big">${F.emptyIcon}</div>${F.empty}</div>`
        : `<div class="people-grid">${friends.map(personCard).join('')}</div>`}
    </div>`;
  $('#copyInvite').onclick = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); }
    catch { const i = $('#inviteUrl'); i.select(); document.execCommand('copy'); }
    toast(F.linkCopied);
  };
  $('#rotateInvite').onclick = async () => {
    if (!confirm(F.confirmNewLink)) return;
    try {
      const r = await api('/api/friends/link/rotate', { method: 'POST' });
      inviteUrl = r.url; $('#inviteUrl').value = r.url;
      toast(F.newLinkDone);
    } catch (err) { toast(err.message, true); }
  };
  $('#shareInvite').onclick = () => openInviteShare('friend', { url: inviteUrl });
  app.querySelectorAll('[data-unfriend]').forEach((btn) => (btn.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm(F.confirmUnfriend)) return;
    try { await api('/api/friends/' + Number(btn.dataset.unfriend), { method: 'DELETE' }); toast(F.unfriendDone); renderFriends(); }
    catch (err) { toast(err.message, true); }
  }));
  app.querySelectorAll('.person').forEach((el) => (el.onclick = () => {
    state.backView = ['friends'];
    go('person', Number(el.dataset.id));
  }));
}

function personCard(u) {
  return `
    <div class="person" data-id="${u.id}">
      <button class="card-x" data-unfriend="${u.id}" title="${esc(C.friends.unfriendTitle)}" aria-label="${esc(C.friends.unfriendTitle)}">✕</button>
      <div class="avatar">${esc(initials(u.name))}</div>
      <h3>${esc(u.name)}</h3>
      <div class="mini">
        <span class="g">${esc(C.friends.cardDuplicates(u.duplicates))}</span>
        <span class="n">${esc(C.friends.cardMissing(u.missing))}</span>
      </div>
    </div>`;
}

// ====== Grupos ======
async function renderGroups() {
  const G = C.groups;
  app.innerHTML = `<div class="empty">${esc(G.loading)}</div>`;
  const { groups } = await api('/api/groups');
  app.innerHTML = `
    <div class="card">
      <h2>${esc(G.createTitle)}</h2>
      <div class="sub">${G.createSub}</div>
      <div class="row">
        <input id="groupName" placeholder="${esc(G.namePlaceholder)}" maxlength="60" />
        <button id="createGroup" style="flex:none">${esc(G.createBtn)}</button>
      </div>
    </div>
    <div class="card">
      <h2>${esc(G.listTitle)} <span style="color:var(--muted);font-weight:400">(${groups.length})</span></h2>
      ${groups.length === 0
        ? `<div class="empty"><div class="big">👥</div>${G.empty}</div>`
        : `<div class="people-grid">${groups.map(groupCard).join('')}</div>`}
    </div>`;
  $('#createGroup').onclick = async () => {
    const name = $('#groupName').value.trim();
    if (!name) { toast(G.nameRequired, true); return; }
    try {
      const { group } = await api('/api/groups', { method: 'POST', body: { name } });
      toast(G.created);
      go('group', group.id);
    } catch (err) { toast(err.message, true); }
  };
  app.querySelectorAll('[data-gid]').forEach((el) => (el.onclick = () => go('group', Number(el.dataset.gid))));
}

function groupCard(g) {
  return `
    <div class="person" data-gid="${g.id}">
      <div class="avatar">${esc(initials(g.name))}</div>
      <h3>${esc(g.name)}</h3>
      <div class="mini"><span class="g">${esc(C.groups.cardMembers(g.members))}</span>${g.owner ? `<span class="n">${esc(C.groups.cardOwner)}</span>` : ''}</div>
    </div>`;
}

async function renderGroup(id) {
  const GR = C.group;
  app.innerHTML = `<div class="empty">${esc(GR.loading)}</div>`;
  const { group, members, matches, link } = await api('/api/groups/' + id);
  let groupUrl = link.url;
  app.innerHTML = `
    <button class="backlink" id="backBtn">${esc(GR.back)}</button>
    <div class="card">
      <h2>${esc(group.name)}</h2>
      <div class="sub">${esc(GR.inviteSub)}</div>
      <div class="row">
        <input id="groupUrl" readonly value="${esc(groupUrl)}" />
        <button id="copyGroup" style="flex:none">${esc(GR.copyLink)}</button>
        ${group.owner ? `<button id="rotateGroup" class="ghost" style="flex:none" title="${esc(GR.newLinkTitle)}">${esc(GR.newLink)}</button>` : ''}
      </div>
      <div class="row" style="margin-top:10px">
        <button id="shareGroup" class="sec" style="flex:none">${esc(C.share.groupBtn)}</button>
      </div>
    </div>
    <div class="card">
      <h2>${esc(GR.membersTitle)} <span style="color:var(--muted);font-weight:400">(${members.length})</span></h2>
      <div class="people-grid">${members.map((u) => memberCard(u, group.owner)).join('')}</div>
      <div class="savebar" style="justify-content:flex-end;margin-top:14px">
        ${group.owner
          ? `<button class="ghost danger" id="deleteGroup">${esc(GR.deleteBtn)}</button>`
          : `<button class="ghost danger" id="leaveGroup">${esc(GR.leaveBtn)}</button>`}
      </div>
    </div>
    <div class="card">
      <h2>${esc(GR.matchesTitle)}</h2>
      <div class="sub">${esc(GR.matchesSub)}</div>
      <div class="legend"><span><span class="dot give"></span>${esc(GR.legendGive)}</span><span><span class="dot get"></span>${esc(GR.legendGet)}</span></div>
      ${matches.length ? matches.map(matchCard).join('') : `<div class="empty">${esc(GR.matchesEmpty)}</div>`}
    </div>`;
  $('#backBtn').onclick = () => go('groups');
  $('#copyGroup').onclick = async () => {
    try { await navigator.clipboard.writeText(groupUrl); }
    catch { const i = $('#groupUrl'); i.select(); document.execCommand('copy'); }
    toast(GR.linkCopied);
  };
  $('#shareGroup').onclick = () => openInviteShare('group', { url: groupUrl, groupName: group.name });
  const rotateBtn = $('#rotateGroup');
  if (rotateBtn) rotateBtn.onclick = async () => {
    if (!confirm(GR.confirmNewLink)) return;
    try {
      const r = await api('/api/groups/' + id + '/rotate', { method: 'POST' });
      groupUrl = r.url; $('#groupUrl').value = r.url;
      toast(GR.newLinkDone);
    } catch (err) { toast(err.message, true); }
  };
  const delBtn = $('#deleteGroup');
  if (delBtn) delBtn.onclick = async () => {
    if (!confirm(GR.confirmDelete)) return;
    try { await api('/api/groups/' + id, { method: 'DELETE' }); toast(GR.deleteDone); go('groups'); }
    catch (err) { toast(err.message, true); }
  };
  const leaveBtn = $('#leaveGroup');
  if (leaveBtn) leaveBtn.onclick = async () => {
    if (!confirm(GR.confirmLeave)) return;
    try { await api('/api/groups/' + id + '/leave', { method: 'POST' }); toast(GR.leaveDone); go('groups'); }
    catch (err) { toast(err.message, true); }
  };
  app.querySelectorAll('[data-remove-member]').forEach((btn) => (btn.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm(GR.confirmRemoveMember)) return;
    try {
      await api('/api/groups/' + id + '/members/' + Number(btn.dataset.removeMember), { method: 'DELETE' });
      toast(GR.removeMemberDone); renderGroup(id);
    } catch (err) { toast(err.message, true); }
  }));
  const openPerson = (pid) => { state.backView = ['group', id]; go('person', pid); };
  app.querySelectorAll('.person[data-id]').forEach((el) => (el.onclick = () => openPerson(Number(el.dataset.id))));
  app.querySelectorAll('[data-goperson]').forEach((el) => (el.onclick = () => openPerson(Number(el.dataset.goperson))));
  state.matchByUser = new Map(matches.map((m) => [m.user.id, m]));
  state.afterTrade = () => go('group', id);
  app.querySelectorAll('.lb-open').forEach((el) => {
    el.onclick = (e) => { e.stopPropagation(); openTradeModal(Number(el.dataset.trade)); };
  });
}

function memberCard(u, canRemove) {
  const me = u.id === state.user.id;
  const GR = C.group;
  return `
    <div class="person" data-id="${u.id}">
      ${canRemove && !u.owner && !me ? `<button class="card-x" data-remove-member="${u.id}" title="${esc(GR.removeMemberTitle)}" aria-label="${esc(GR.removeMemberTitle)}">✕</button>` : ''}
      <div class="avatar">${esc(initials(u.name))}</div>
      <h3>${esc(u.name)}${me ? esc(GR.you) : ''}${u.owner ? esc(GR.ownerCrown) : ''}</h3>
      <div class="mini">
        <span class="g">${esc(GR.memberDuplicates(u.duplicates))}</span>
        <span class="n">${esc(GR.memberMissing(u.missing))}</span>
      </div>
    </div>`;
}

// ====== Perfil de outra pessoa ======
async function renderPerson(id) {
  if (id === state.user.id) return go('profile');
  const PE = C.person;
  app.innerHTML = `<div class="empty">${esc(PE.loading)}</div>`;
  const [profile, matchData] = await Promise.all([
    api(`/api/users/${id}`),
    api(`/api/users/${id}/matches`),
  ]);
  const u = profile.user;
  const first = u.name.split(' ')[0];
  const match = matchData.matches.find((m) => m.user.id === id);

  app.innerHTML = `
    <button class="backlink" id="backBtn">${esc(PE.back)}</button>
    <div class="card">
      <div class="match-head" style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
        <div class="avatar" style="width:46px;height:46px;background:var(--accent);color:#09090b;display:grid;place-items:center;">${esc(initials(u.name))}</div>
        <div>
          <h2 style="margin:0">${esc(u.name)}</h2>
          <div class="apt" style="color:var(--muted);font-size:13px">${esc(u.email || '')}</div>
        </div>
      </div>
      ${match ? matchBox(match) : `<div class="sub" style="margin-top:12px">${esc(PE.noMatch)}</div>`}
    </div>

    <div class="card">
      <h2>${esc(PE.duplicatesTitle(first))} <span style="color:var(--muted);font-weight:400">(${profile.duplicates.length})</span></h2>
      <div class="sub">${esc(PE.duplicatesSub(first))}</div>
      ${chipList(profile.duplicates, 'give', profile.missing)}
    </div>

    <div class="card">
      <h2>${esc(PE.missingTitle(first))} <span style="color:var(--muted);font-weight:400">(${profile.missing.length})</span></h2>
      <div class="sub">${esc(PE.missingSub(first))}</div>
      ${chipList(profile.missing, 'get')}
    </div>`;

  $('#backBtn').onclick = () => go(...(state.backView || ['friends']));
}

function matchBox(m) {
  return `
    <div class="match ${m.mutual ? 'mutual' : ''}" style="margin-top:12px">
      ${m.mutual ? `<span class="tag perfect">${esc(C.person.perfectTag(m.mutual))}</span>` : ''}
      <div class="block give">
        <div class="label">${esc(C.person.youGiveLabel(m.youGive.length))}</div>
        ${m.youGive.length ? `<div class="chips">${m.youGive.map((s) => chip(s, 'give')).join('')}</div>` : `<span style="color:var(--muted);font-size:13px">${esc(C.person.nothingYet)}</span>`}
      </div>
      <div class="block get">
        <div class="label">${esc(C.person.youGetLabel(m.youGet.length))}</div>
        ${m.youGet.length ? `<div class="chips">${m.youGet.map((s) => chip(s, 'get')).join('')}</div>` : `<span style="color:var(--muted);font-size:13px">${esc(C.person.nothingYet)}</span>`}
      </div>
    </div>`;
}

function chip(s, kind = '') {
  return `<span class="chip ${kind}"><b>${s.code}</b></span>`;
}
function chipList(arr, kind, highlightAgainst) {
  if (!arr.length) return `<div style="color:var(--muted);font-size:13px">${esc(C.person.noneRegistered)}</div>`;
  return `<div class="chips">${arr.map((s) => chip(s, kind)).join('')}</div>`;
}

// ====== Trocas / cruzamentos (entre amigos) ======
async function renderMatches() {
  const MT = C.matches;
  app.innerHTML = `<div class="empty">${esc(MT.loading)}</div>`;
  const { matches } = await api('/api/matches');

  if (!matches.length) {
    app.innerHTML = `
      <div class="card">
        <h2>${esc(MT.emptyTitle)}</h2>
        <div class="empty"><div class="big">${MT.emptyIcon}</div>${MT.empty}</div>
      </div>`;
    return;
  }

  app.innerHTML = `
    <div class="card">
      <h2>${esc(MT.title)}</h2>
      <div class="sub">${MT.sub(matches.length)}</div>
      <div class="legend">
        <span><span class="dot give"></span>${esc(MT.legendGive)}</span>
        <span><span class="dot get"></span>${esc(MT.legendGet)}</span>
      </div>
      ${matches.map(matchCard).join('')}
    </div>`;
  state.matchByUser = new Map(matches.map((m) => [m.user.id, m]));
  state.afterTrade = () => go('matches');
  app.querySelectorAll('[data-goperson]').forEach((el) => {
    el.onclick = () => go('person', Number(el.dataset.goperson));
  });
  app.querySelectorAll('.lb-open').forEach((el) => {
    el.onclick = (e) => { e.stopPropagation(); openTradeModal(Number(el.dataset.trade)); };
  });
}

function matchCard(m) {
  return `
    <div class="match ${m.mutual ? 'mutual' : ''}">
      <div class="head">
        <div class="avatar" style="width:36px;height:36px;background:var(--accent);color:#09090b;display:grid;place-items:center;font-size:14px">${esc(initials(m.user.name))}</div>
        <h3 data-goperson="${m.user.id}" style="cursor:pointer">${esc(m.user.name)}</h3>
        ${m.mutual ? `<span class="tag perfect">${esc(C.matches.perfectTag(m.mutual))}</span>` : ''}
      </div>
      <div class="block give">
        <div class="label">${esc(C.matches.youGive(m.youGive.length))}</div>
        ${m.youGive.length ? `<div class="chips">${m.youGive.map((s) => chip(s, 'give')).join('')}</div>` : `<span style="color:var(--muted);font-size:13px">—</span>`}
      </div>
      <div class="block get">
        <div class="label">${esc(C.matches.youGet(m.youGet.length))}</div>
        ${m.youGet.length ? `<div class="chips">${m.youGet.map((s) => chip(s, 'get')).join('')}</div>` : `<span style="color:var(--muted);font-size:13px">—</span>`}
      </div>
      <div class="match-actions">
        <button class="sec lb-open" type="button" data-trade="${m.user.id}">${esc(C.matches.markTrade)}</button>
      </div>
    </div>`;
}

// ====== Lightbox: registrar troca feita ======
function tradeChk(s, kind) {
  return `<label class="chk"><input type="checkbox" checked value="${esc(s.code)}" data-kind="${kind}" /><span><b>${esc(s.code)}</b></span></label>`;
}

async function openTradeModal(friendId) {
  const m = state.matchByUser && state.matchByUser.get(friendId);
  if (!m) return;
  const wrap = document.createElement('div');
  wrap.className = 'lightbox';
  const T = C.trade;
  wrap.innerHTML = `
    <div class="lb-card">
      <h2>${esc(T.title(m.user.name.split(' ')[0]))}</h2>
      <div class="sub">${esc(T.sub)}</div>
      <div class="lb-group">
        <div class="lb-head"><span>${esc(T.gotHead)}</span><button class="link" type="button" data-all="get">${esc(T.selectAll)}</button></div>
        <div class="lb-chips" data-group="get">${m.youGet.length ? m.youGet.map((s) => tradeChk(s, 'get')).join('') : `<span class="muted">${esc(T.nothingHere)}</span>`}</div>
      </div>
      <div class="lb-group">
        <div class="lb-head"><span>${esc(T.gaveHead)}</span><button class="link" type="button" data-all="give">${esc(T.selectAll)}</button></div>
        <div class="lb-chips" data-group="give">${m.youGive.length ? m.youGive.map((s) => tradeChk(s, 'give')).join('') : `<span class="muted">${esc(T.nothingHere)}</span>`}</div>
      </div>
      <div class="lb-actions">
        <button class="ghost" type="button" id="lbCancel">${esc(T.cancel)}</button>
        <button type="button" id="lbConfirm">${esc(T.confirm)}</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  wrap.querySelector('#lbCancel').onclick = close;
  wrap.querySelectorAll('.link[data-all]').forEach((btn) => {
    btn.onclick = () => {
      const boxes = [...wrap.querySelectorAll(`.lb-chips[data-group="${btn.dataset.all}"] input`)];
      const allChecked = boxes.length && boxes.every((b) => b.checked);
      boxes.forEach((b) => (b.checked = !allChecked));
    };
  });
  wrap.querySelector('#lbConfirm').onclick = async () => {
    const checked = (g) => [...wrap.querySelectorAll(`.lb-chips[data-group="${g}"] input:checked`)].map((b) => b.value);
    const rmMiss = new Set(checked('get'));
    const rmDup = new Set(checked('give'));
    if (!rmMiss.size && !rmDup.size) { toast(T.selectAtLeastOne, true); return; }
    try {
      const data = await api(`/api/users/${state.user.id}`);
      const missing = data.missing.map((s) => s.code).filter((c) => !rmMiss.has(c));
      const duplicates = data.duplicates.map((s) => s.code).filter((c) => !rmDup.has(c));
      await api(`/api/users/${state.user.id}/stickers`, { method: 'PUT', body: { missing, duplicates } });
      close();
      toast(T.done);
      if (state.afterTrade) state.afterTrade();
    } catch (err) { toast(err.message, true); }
  };
}

// ====== Painel de admin ======
let adminUsers = [];
async function renderAdmin() {
  if (!state.user || !state.user.admin) return go('profile'); // proteção no cliente (servidor também barra)
  const A = C.admin;
  setActiveNav('admin');
  app.innerHTML = `<div class="empty">${esc(A.loading)}</div>`;
  try {
    const data = await api('/api/admin/users');
    adminUsers = data.users;
  } catch (err) {
    app.innerHTML = `<div class="card"><div class="empty">${esc(err.message)}</div></div>`;
    return;
  }

  app.innerHTML = `
    <div class="card">
      <h2>${esc(A.title)}</h2>
      <div class="sub">${esc(A.subtitle(adminUsers.length))}</div>
      <div class="editor-toolbar"><input id="adminFilter" placeholder="${esc(A.search)}" /></div>
      <div class="admin-wrap"><table class="admin-table" id="adminTable"></table></div>
    </div>`;

  const draw = (filter = '') => {
    const list = adminUsers.filter(
      (u) => !filter || u.name.toLowerCase().includes(filter) || u.email.toLowerCase().includes(filter)
    );
    $('#adminTable').innerHTML = `
      <thead><tr>
        <th>${esc(A.colName)}</th><th>${esc(A.colEmail)}</th><th>${esc(A.colJoined)}</th>
        <th>${esc(A.colAlbum)}</th><th>${esc(A.colNetwork)}</th><th>${esc(A.colStatus)}</th><th>${esc(A.colActions)}</th>
      </tr></thead>
      <tbody>${list.length ? list.map(adminRow).join('') : `<tr><td colspan="7" class="empty">${esc(filter ? A.noResults : A.empty)}</td></tr>`}</tbody>`;
  };
  draw('');
  $('#adminFilter').oninput = (e) => draw(e.target.value.trim().toLowerCase());

  $('#adminTable').onclick = async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const u = adminUsers.find((x) => x.id === id);
    if (!u) return;
    try {
      if (btn.dataset.act === 'edit') {
        const name = prompt(A.editNamePrompt, u.name);
        if (name === null) return;
        const email = prompt(A.editEmailPrompt, u.email);
        if (email === null) return;
        const body = {};
        if (name.trim() && name.trim() !== u.name) body.name = name.trim();
        if (email.trim() && email.trim().toLowerCase() !== u.email) body.email = email.trim();
        if (!Object.keys(body).length) return;
        await api('/api/admin/users/' + id, { method: 'PATCH', body });
        toast(A.updated);
      } else if (btn.dataset.act === 'ban') {
        const toBan = !u.banned;
        if (!confirm(toBan ? A.confirmBan(u.name) : A.confirmUnban(u.name))) return;
        await api('/api/admin/users/' + id + '/ban', { method: 'POST', body: { banned: toBan } });
        toast(toBan ? A.banned : A.unbanned);
      } else if (btn.dataset.act === 'del') {
        if (!confirm(A.confirmDelete(u.name))) return;
        await api('/api/admin/users/' + id, { method: 'DELETE' });
        toast(A.deleted);
      }
      renderAdmin();
    } catch (err) { toast(err.message, true); }
  };
}

function adminRow(u) {
  const A = C.admin;
  const badges = [
    u.admin ? `<span class="tag adm">${esc(A.badgeAdmin)}</span>` : '',
    u.google ? `<span class="tag ggl">${esc(A.badgeGoogle)}</span>` : '',
    u.banned ? `<span class="tag ban">${esc(A.badgeBanned)}</span>` : `<span class="tag ok">${esc(A.badgeActive)}</span>`,
  ].filter(Boolean).join(' ');
  const d = new Date(u.createdAt);
  const joined = isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
  const actions = u.admin
    ? `<span class="muted">—</span>`
    : `<button class="mini-btn" data-act="edit" data-id="${u.id}">${esc(A.edit)}</button>
       <button class="mini-btn" data-act="ban" data-id="${u.id}">${esc(u.banned ? A.unban : A.ban)}</button>
       <button class="mini-btn danger" data-act="del" data-id="${u.id}">${esc(A.del)}</button>`;
  return `<tr class="${u.banned ? 'is-banned' : ''}">
    <td><b>${esc(u.name)}</b></td>
    <td class="mono">${esc(u.email)}</td>
    <td>${esc(joined)}</td>
    <td>${esc(A.albumCell(u.missing, u.duplicates))}</td>
    <td>${esc(A.networkCell(u.friends, u.groups))}</td>
    <td>${badges}</td>
    <td class="admin-actions">${actions}</td>
  </tr>`;
}

// ====== Convite pendente (link ?convite=token ou ?grupo=token) ======
// Guardamos em sessionStorage para sobreviver à limpeza da URL e ao
// redirecionamento do login com Google.
function capturePendingInvite() {
  const q = new URLSearchParams(location.search);
  const conv = q.get('convite');
  const grp = q.get('grupo');
  if (conv) sessionStorage.setItem('pendingInvite', JSON.stringify({ kind: 'friend', token: conv }));
  else if (grp) sessionStorage.setItem('pendingInvite', JSON.stringify({ kind: 'group', token: grp }));
  if (conv || grp) history.replaceState(null, '', location.pathname); // limpa a URL
}
function getPendingInvite() {
  try { return JSON.parse(sessionStorage.getItem('pendingInvite') || 'null'); }
  catch { return null; }
}
function clearPendingInvite() { sessionStorage.removeItem('pendingInvite'); }

// Busca o preview do convite (endpoint público — funciona logado ou não).
async function fetchInvite(inv) {
  const base = inv.kind === 'friend' ? '/api/friends/invite/' : '/api/groups/invite/';
  return api(base + encodeURIComponent(inv.token));
}

// ====== Tela de convite recebido (usuário já logado) ======
async function renderInvite(inv) {
  const I = C.invite;
  setActiveNav(null);
  app.innerHTML = `<div class="empty">${esc(I.loading)}</div>`;
  let info;
  try { info = await fetchInvite(inv); }
  catch (err) { clearPendingInvite(); toast(err.message || I.error, true); return go('profile'); }

  // Já resolvido (próprio link / já é membro): manda direto e sai.
  if (inv.kind === 'friend' && info.isSelf) { clearPendingInvite(); toast(I.friendSelf); return go('friends'); }
  if (inv.kind === 'group' && info.isMember) { clearPendingInvite(); toast(I.groupAlready); return go('group', info.group.id); }

  const isGroup = inv.kind === 'group';
  const title = isGroup ? I.groupTitle(info.group.name) : I.friendTitle(info.inviter.name);
  const sub = isGroup ? I.groupSub(info.group.ownerName) : I.friendSub;
  const avatarName = isGroup ? info.group.name : info.inviter.name;

  app.innerHTML = `
    <div class="card invite-card">
      <div class="invite-hero">
        <div class="avatar big">${esc(initials(avatarName))}</div>
        <h2>${esc(title)}</h2>
        ${isGroup ? `<div class="invite-meta">${esc(I.groupMembers(info.group.members))}</div>` : ''}
      </div>
      <div class="sub">${esc(sub)}</div>
      <div class="invite-actions">
        <button class="ghost" id="invDecline">${esc(I.decline)}</button>
        <button id="invAccept">${esc(I.accept)}</button>
      </div>
    </div>`;

  $('#invDecline').onclick = () => { clearPendingInvite(); go('profile'); };
  $('#invAccept').onclick = async () => {
    try {
      if (isGroup) {
        const { group } = await api('/api/groups/join', { method: 'POST', body: { token: inv.token } });
        clearPendingInvite(); toast(I.groupJoined); go('group', group.id);
      } else {
        await api('/api/friends/accept', { method: 'POST', body: { token: inv.token } });
        clearPendingInvite(); toast(I.friendAccepted);
        state.backView = ['friends']; go('person', info.inviter.id);
      }
    } catch (err) { toast(err.message, true); }
  };
}

// ====== Boot ======
async function boot() {
  $('#nav').classList.remove('hidden');
  document.body.classList.add('logged-in'); // some com o cursor custom fora da home
  $('#whoami').textContent = state.user.name;
  $('#navAdmin').classList.toggle('hidden', !state.user.admin); // só admin vê
  const inv = getPendingInvite();
  if (inv) return renderInvite(inv); // convite tem prioridade sobre a home
  go('profile');
}

async function logout() {
  if (state.dirty && !confirm(C.common.logoutUnsaved)) return;
  try { await api('/api/logout', { method: 'POST' }); } catch (e) { /* ok */ }
  state.user = null;
  state.dirty = false;
  renderAuth();
}

// ====== Convidar por email / copiar mensagem (lightbox) ======
function openInviteShare(kind, ctx) {
  const S = C.share;
  const me = (state.user && state.user.name) || '';
  const isGroup = kind === 'group';
  const subject = isGroup ? S.groupSubject(me, ctx.groupName) : S.friendSubject(me);
  const message = isGroup ? S.groupMessage(me, ctx.groupName, ctx.url) : S.friendMessage(me, ctx.url);
  const subtitle = isGroup ? S.groupSubtitle : S.friendSubtitle;

  const wrap = document.createElement('div');
  wrap.className = 'lightbox';
  wrap.innerHTML = `
    <div class="lb-card">
      <h2>${esc(S.title)}</h2>
      <div class="sub">${esc(subtitle)}</div>
      <div class="field">
        <label>${esc(S.toLabel)}</label>
        <input id="invTo" type="email" placeholder="${esc(S.toPlaceholder)}" />
      </div>
      <div class="field">
        <label>${esc(S.msgLabel)}</label>
        <textarea id="invMsg" rows="7">${esc(message)}</textarea>
      </div>
      <div class="lb-actions">
        <button class="ghost" type="button" id="invCopy">${esc(S.copyBtn)}</button>
        <button type="button" id="invSend">${esc(S.sendBtn)}</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.onclick = (e) => { if (e.target === wrap) close(); };

  wrap.querySelector('#invCopy').onclick = async () => {
    const msg = wrap.querySelector('#invMsg').value;
    try { await navigator.clipboard.writeText(msg); }
    catch { const t = wrap.querySelector('#invMsg'); t.select(); document.execCommand('copy'); }
    toast(S.copied);
  };
  wrap.querySelector('#invSend').onclick = () => {
    const to = wrap.querySelector('#invTo').value.trim();
    const msg = wrap.querySelector('#invMsg').value;
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
    window.location.href = href;
    close();
    toast(S.opening);
  };
}

// ====== Reportar bug (lightbox -> e-mail) ======
function openBugReport() {
  const wrap = document.createElement('div');
  wrap.className = 'lightbox';
  const B = C.bug;
  wrap.innerHTML = `
    <div class="lb-card">
      <h2>${esc(B.title)}</h2>
      <div class="sub">${B.sub}</div>
      <div class="field">
        <label>${esc(B.emailLabel)}</label>
        <input id="bugEmail" type="email" placeholder="${esc(B.emailPlaceholder)}" />
      </div>
      <div class="field">
        <label>${esc(B.msgLabel)}</label>
        <textarea id="bugMsg" placeholder="${esc(B.msgPlaceholder)}"></textarea>
      </div>
      <div class="lb-actions">
        <button class="ghost" type="button" id="bugCancel">${esc(B.cancel)}</button>
        <button type="button" id="bugSend">${esc(B.send)}</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  wrap.querySelector('#bugCancel').onclick = close;
  wrap.querySelector('#bugSend').onclick = () => {
    const msg = wrap.querySelector('#bugMsg').value.trim();
    const from = wrap.querySelector('#bugEmail').value.trim();
    if (!msg) { toast(B.needMsg, true); return; }
    const subject = encodeURIComponent(B.emailSubject);
    const body = encodeURIComponent(`${msg}\n\n---\nDe: ${from || '(não informado)'}\nUsuário: ${state.user ? state.user.name + ' (id ' + state.user.id + ')' : 'deslogado'}\nPágina: ${location.href}\nNavegador: ${navigator.userAgent}`);
    window.location.href = `mailto:${B.to}?subject=${subject}&body=${body}`;
    close();
    toast(B.opening);
  };
}

async function init() {
  window._go = go; // usado por onclick inline
  applyMeta();     // título da aba, cabeçalho, nav e crédito vindos de content.js
  capturePendingInvite(); // guarda ?convite= / ?grupo= antes de qualquer coisa
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.report-bugs');
    if (b) { e.preventDefault(); openBugReport(); }
  });
  document.querySelectorAll('#nav button[data-view]').forEach((b) => {
    b.onclick = () => go(b.dataset.view);
  });
  $('#logoutBtn').onclick = logout;

  // Sessao vive no cookie httpOnly; /api/me decide se ja esta logado.
  try {
    const data = await api('/api/me');
    state.user = data.user;
    await boot();
  } catch {
    renderAuth();
  }
}

init();
