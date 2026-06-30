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
    if (!confirm('Você tem alterações não salvas no seu álbum. Sair mesmo assim?')) return;
    state.dirty = false;
  }
  setActiveNav(view);
  if (view === 'profile') return renderProfile();
  if (view === 'friends') return renderFriends();
  if (view === 'groups') return renderGroups();
  if (view === 'group') return renderGroup(arg);
  if (view === 'matches') return renderMatches();
  if (view === 'person') return renderPerson(arg);
}

// ====== Tela de login / cadastro ======
async function renderAuth() {
  $('#nav').classList.add('hidden');
  let cfg = { turnstileSiteKey: '' };
  try { cfg = await api('/api/config'); } catch (e) { /* segue sem */ }

  app.innerHTML = `
    <div class="hero">
      <span class="sticker-badge">⚽ Álbum de figurinhas · Copa 2026</span>
      <h1 class="glitch" data-text="ÁLBUM DA COPA">ÁLBUM<br/>DA COPA</h1>
      <p>Monte seu álbum, convide amigos e cruze quem tem o que falta pra você.
         Crie sua conta para começar — é de graça.</p>
      <div class="credit">powered by claude code · made by <a href="https://www.linkedin.com/in/fdrudi/" target="_blank" rel="noopener noreferrer">fernando drudi</a></div>
      <div class="marquee" aria-hidden="true"><div>
        <span>Bora completar o álbum</span><span>993 figurinhas</span><span>48 seleções</span><span>trocas perfeitas</span>
        <span>Bora completar o álbum</span><span>993 figurinhas</span><span>48 seleções</span><span>trocas perfeitas</span>
      </div></div>
    </div>
    <div class="card" style="max-width:480px;">
      <div class="tabs">
        <button id="tabReg" class="active">Criar conta</button>
        <button id="tabLogin">Já tenho conta</button>
      </div>
      <form id="authForm">
        <div class="field" id="nameField">
          <label>Nome</label>
          <input name="name" placeholder="Seu nome" autocomplete="name" />
        </div>
        <div class="field">
          <label>E-mail</label>
          <input name="email" type="email" placeholder="voce@email.com" autocomplete="email" />
        </div>
        <div class="field">
          <label>Senha</label>
          <input name="password" type="password" placeholder="Mínimo 8 caracteres" autocomplete="current-password" />
        </div>
        <label class="check" id="ageField">
          <input name="age" type="checkbox" />
          <span>Declaro que tenho <b>18 anos ou mais</b>.</span>
        </label>
        <div id="tsWidget" class="ts-widget"></div>
        <button type="submit" style="width:100%">Entrar</button>
      </form>
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
    if (cfg.turnstileSiteKey && !tsToken) { toast('Confirme que você é humano.', true); return; }
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
        toast('Conta criada! 🎉');
      } else {
        data = await api('/api/login', {
          method: 'POST',
          body: { email: f.email.value, password: f.password.value, turnstileToken: tsToken },
        });
        toast('Bem-vindo de volta!');
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
  app.innerHTML = `<div class="empty">Carregando seu álbum…</div>`;
  await loadCatalog();
  const data = await api(`/api/users/${state.user.id}`);

  // Inicializa rascunho a partir do servidor.
  state.edit = new Map();
  for (const s of data.missing) state.edit.set(s.code, 'missing');
  for (const s of data.duplicates) state.edit.set(s.code, 'duplicate');
  state.dirty = false;

  app.innerHTML = `
    <div class="card">
      <h2>Meu Álbum — Copa 2026</h2>
      <div class="sub">Marque o que <b style="color:var(--get)">falta</b> (quero) e o que está
        <b style="color:var(--give)">repetida</b> (tenho de sobra). Use a busca para achar rápido.</div>
      <div class="stats" id="profileStats"></div>
      <div class="legend">
        <span><span class="dot get"></span>Falta — preciso desta</span>
        <span><span class="dot give"></span>Repetida — tenho pra trocar</span>
      </div>
      <div class="editor-toolbar">
        <input id="filterInput" placeholder="🔎 Filtrar por código ou país (ex.: BRA, 07, Argentina)" />
        <button class="sec" id="expandAll">Expandir tudo</button>
        <button class="sec" id="collapseAll">Recolher</button>
        <button class="sec" id="exportBtn">📤 Exportar card</button>
      </div>
      <div id="sections"></div>
      <div class="savebar">
        <span class="muted" id="dirtyHint"></span>
        <button class="ghost" id="resetBtn">Desfazer</button>
        <button id="saveBtn">Salvar álbum</button>
      </div>
    </div>`;

  renderSections('');
  updateProfileStats();

  $('#filterInput').oninput = (e) => renderSections(e.target.value.trim().toLowerCase());
  $('#expandAll').onclick = () => document.querySelectorAll('#sections .section').forEach((d) => (d.open = true));
  $('#collapseAll').onclick = () => document.querySelectorAll('#sections .section').forEach((d) => (d.open = false));
  $('#saveBtn').onclick = saveAlbum;
  $('#resetBtn').onclick = () => renderProfile();
  $('#exportBtn').onclick = exportCard;
}

function updateProfileStats() {
  let miss = 0, dup = 0;
  for (const v of state.edit.values()) v === 'missing' ? miss++ : dup++;
  const have = state.catalog.total - miss; // estimativa: o que nao falta
  $('#profileStats').innerHTML = `
    <div class="stat"><b>${state.catalog.total}</b><span>no álbum</span></div>
    <div class="stat"><b style="color:var(--get)">${miss}</b><span>faltando</span></div>
    <div class="stat"><b style="color:var(--give)">${dup}</b><span>repetidas</span></div>`;
  const hint = $('#dirtyHint');
  if (hint) hint.textContent = state.dirty ? 'Alterações não salvas…' : 'Tudo salvo ✓';
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
      html += `<div class="group-head">Grupo ${esc(sec.group)}</div>`;
      lastGroup = sec.group;
    }
    const open = filter ? 'open' : '';
    let selCount = 0;
    for (const s of sec.stickers) if (state.edit.has(s.code)) selCount++;

    // Reproducao da pagina do album: spread de duas paginas (4 colunas cada),
    // com posicoes fixas por numero — escudo(01)/elenco(02) no topo, etc.
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
          <span class="count">${selCount ? selCount + ' marcadas · ' : ''}${matches.length} fig.</span>
        </summary>
        ${body}
      </details>`;
  }
  wrap.innerHTML = html || `<div class="empty">Nenhuma figurinha encontrada para esse filtro.</div>`;

  wrap.querySelectorAll('.toggles button').forEach((btn) => {
    btn.onclick = () => toggleSticker(btn.dataset.code, btn.dataset.kind);
  });
}

function stickerRow(s, pos) {
  const status = state.edit.get(s.code);
  const cls = status === 'missing' ? 'is-miss' : status === 'duplicate' ? 'is-dup' : '';
  // Quebra o codigo em prefixo + numero (ex.: BRA07 -> BRA / 7), estilo album.
  const m = /^([A-Za-z]+)(\d+)$/.exec(s.code);
  const prefix = m ? m[1] : s.code;
  const num = m ? String(Number(m[2])) : '';
  // Posicao fixa na pagina do album (linha/coluna), quando fornecida.
  const style = pos ? ` style="grid-row:${pos.r};grid-column:${pos.c}"` : '';
  return `
    <div class="sticker ${cls}" data-code="${s.code}"${style}>
      <span class="slot-num"><i>${prefix}</i><b>${num}</b></span>
      <span class="slot-ph" aria-hidden="true"></span>
      <span class="toggles">
        <button class="miss ${status === 'missing' ? 'on' : ''}" data-code="${s.code}" data-kind="missing" title="Falta">Falta</button>
        <button class="dup ${status === 'duplicate' ? 'on' : ''}" data-code="${s.code}" data-kind="duplicate" title="Repetida">Rep.</button>
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
    toast('Álbum salvo! ✅');
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

  const INK = '#09090b', PAPER = '#f8f4e8', ACID = '#d2e823', MUT = '#5c5c52';
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // garante fontes carregadas antes de desenhar
  try {
    await Promise.all([
      document.fonts.load('400 96px "Dela Gothic One"'),
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
  // badge
  block(M, 64, 430, 54, 27, ACID);
  ctx.fillStyle = INK; ctx.font = '700 22px "Space Grotesk"'; ctx.textBaseline = 'middle';
  ctx.fillText('⚽  COPA 2026 · MEU ÁLBUM', M + 24, 64 + 29);

  // titulo
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = INK; ctx.font = '400 92px "Dela Gothic One"';
  ctx.fillText('ÁLBUM', M, 232);
  ctx.fillText('DA COPA', M, 232 + 90);

  // usuario
  ctx.font = '700 30px "Space Grotesk"';
  ctx.fillText(`${(state.user.name || '').toUpperCase()} · APTO ${(state.user.apartment || '').toUpperCase()}`, M, 232 + 90 + 56);

  // caixas de contagem
  const boxW = (W - M * 2 - 24) / 2, boxY = 470, boxH = 130;
  block(M, boxY, boxW, boxH, 12, ACID);
  block(M + boxW + 24, boxY, boxW, boxH, 12, INK);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK; ctx.font = '400 64px "Dela Gothic One"';
  ctx.fillText(String(miss.length), M + 26, boxY + 78);
  ctx.font = '700 22px "Space Grotesk"'; ctx.fillStyle = INK;
  ctx.fillText('FALTAM (QUERO)', M + 26, boxY + 108);
  ctx.fillStyle = ACID; ctx.font = '400 64px "Dela Gothic One"';
  ctx.fillText(String(dup.length), M + boxW + 24 + 26, boxY + 78);
  ctx.font = '700 22px "Space Grotesk"';
  ctx.fillText('REPETIDAS (TROCO)', M + boxW + 24 + 26, boxY + 108);

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
      ctx.fillText('— nada marcado —', x, y + h / 2);
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
  ctx.fillText('🎯 FALTAM', M, 658);
  drawCodes(miss, M, 680, contentW, 4, ACID, INK);

  ctx.fillStyle = INK; ctx.font = '700 24px "Space Grotesk"'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('🔁 REPETIDAS', M, 968);
  drawCodes(dup, M, 990, contentW, 4, INK, ACID);

  // rodape
  ctx.fillStyle = INK; ctx.fillRect(22, H - 96, W - 44, 2);
  ctx.fillStyle = MUT; ctx.font = '500 22px "Space Grotesk"'; ctx.textBaseline = 'middle';
  ctx.fillText('powered by claude code · made by fernando drudi', M, H - 58);

  // exporta / compartilha
  cv.toBlob(async (blob) => {
    if (!blob) { toast('Não consegui gerar o card.', true); return; }
    const file = new File([blob], 'meu-album-copa-2026.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Meu Álbum da Copa', text: 'Minhas figurinhas: faltantes e repetidas 🔁' });
        return;
      }
    } catch (e) { /* cai pro download */ }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'meu-album-copa-2026.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Card exportado! 📤');
  }, 'image/png');
}

// ====== Amigos (convite por link + aceite) ======
async function renderFriends() {
  app.innerHTML = `<div class="empty">Carregando amigos…</div>`;
  const [link, data] = await Promise.all([
    api('/api/friends/link').catch(() => ({ url: '' })),
    api('/api/friends'),
  ]);
  const friends = data.friends;
  app.innerHTML = `
    <div class="card">
      <h2>Convidar amigo</h2>
      <div class="sub">Mande seu link. Quando a pessoa <b>aceitar</b>, os álbuns de vocês
        ficam visíveis e o app cruza o que falta com o que sobra.</div>
      <div class="row">
        <input id="inviteUrl" readonly value="${esc(link.url)}" />
        <button id="copyInvite" style="flex:none">Copiar link</button>
      </div>
    </div>
    <div class="card">
      <h2>Meus amigos <span style="color:var(--muted);font-weight:400">(${friends.length})</span></h2>
      ${friends.length === 0
        ? `<div class="empty"><div class="big">🤝</div>Você ainda não tem amigos por aqui.<br/>Compartilhe seu link de convite!</div>`
        : `<div class="people-grid">${friends.map(personCard).join('')}</div>`}
    </div>`;
  $('#copyInvite').onclick = async () => {
    try { await navigator.clipboard.writeText(link.url); }
    catch { const i = $('#inviteUrl'); i.select(); document.execCommand('copy'); }
    toast('Link copiado! 📋');
  };
  app.querySelectorAll('.person').forEach((el) => (el.onclick = () => {
    state.backView = ['friends'];
    go('person', Number(el.dataset.id));
  }));
}

function personCard(u) {
  return `
    <div class="person" data-id="${u.id}">
      <div class="avatar">${esc(initials(u.name))}</div>
      <h3>${esc(u.name)}</h3>
      <div class="mini">
        <span class="g">🔁 ${u.duplicates} repetidas</span>
        <span class="n">🎯 ${u.missing} faltando</span>
      </div>
    </div>`;
}

// ====== Grupos ======
async function renderGroups() {
  app.innerHTML = `<div class="empty">Carregando grupos…</div>`;
  const { groups } = await api('/api/groups');
  app.innerHTML = `
    <div class="card">
      <h2>Criar grupo</h2>
      <div class="sub">Crie um grupo e convide quem quiser. Todos que entrarem veem os álbuns
        uns dos outros e o app cruza as figurinhas entre <b>todos</b> os membros.</div>
      <div class="row">
        <input id="groupName" placeholder="Nome do grupo (ex.: Galera do trampo)" maxlength="60" />
        <button id="createGroup" style="flex:none">Criar</button>
      </div>
    </div>
    <div class="card">
      <h2>Meus grupos <span style="color:var(--muted);font-weight:400">(${groups.length})</span></h2>
      ${groups.length === 0
        ? `<div class="empty"><div class="big">👥</div>Você ainda não participa de nenhum grupo.<br/>Crie um acima ou entre por um link de convite.</div>`
        : `<div class="people-grid">${groups.map(groupCard).join('')}</div>`}
    </div>`;
  $('#createGroup').onclick = async () => {
    const name = $('#groupName').value.trim();
    if (!name) { toast('Dê um nome ao grupo.', true); return; }
    try {
      const { group } = await api('/api/groups', { method: 'POST', body: { name } });
      toast('Grupo criado! 👥');
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
      <div class="mini"><span class="g">👥 ${g.members} ${g.members === 1 ? 'membro' : 'membros'}</span>${g.owner ? '<span class="n">👑 dono</span>' : ''}</div>
    </div>`;
}

async function renderGroup(id) {
  app.innerHTML = `<div class="empty">Carregando grupo…</div>`;
  const { group, members, matches, link } = await api('/api/groups/' + id);
  app.innerHTML = `
    <button class="backlink" id="backBtn">← Voltar para grupos</button>
    <div class="card">
      <h2>${esc(group.name)}</h2>
      <div class="sub">Convide gente pro grupo. Quem entrar vê os álbuns de todos e entra no cruzamento.</div>
      <div class="row">
        <input id="groupUrl" readonly value="${esc(link.url)}" />
        <button id="copyGroup" style="flex:none">Copiar link</button>
      </div>
    </div>
    <div class="card">
      <h2>Membros <span style="color:var(--muted);font-weight:400">(${members.length})</span></h2>
      <div class="people-grid">${members.map(memberCard).join('')}</div>
    </div>
    <div class="card">
      <h2>Trocas no grupo 🔄</h2>
      <div class="sub">Seu cruzamento com os outros membros. As perfeitas (mão dupla) primeiro.</div>
      <div class="legend"><span><span class="dot give"></span>Você dá</span><span><span class="dot get"></span>Você recebe</span></div>
      ${matches.length ? matches.map(matchCard).join('') : `<div class="empty">Nenhuma troca com os membros ainda.</div>`}
    </div>`;
  $('#backBtn').onclick = () => go('groups');
  $('#copyGroup').onclick = async () => {
    try { await navigator.clipboard.writeText(link.url); }
    catch { const i = $('#groupUrl'); i.select(); document.execCommand('copy'); }
    toast('Link copiado! 📋');
  };
  const openPerson = (pid) => { state.backView = ['group', id]; go('person', pid); };
  app.querySelectorAll('.person[data-id]').forEach((el) => (el.onclick = () => openPerson(Number(el.dataset.id))));
  app.querySelectorAll('[data-goperson]').forEach((el) => (el.onclick = () => openPerson(Number(el.dataset.goperson))));
}

function memberCard(u) {
  const me = u.id === state.user.id;
  return `
    <div class="person" data-id="${u.id}">
      <div class="avatar">${esc(initials(u.name))}</div>
      <h3>${esc(u.name)}${me ? ' (você)' : ''}${u.owner ? ' 👑' : ''}</h3>
      <div class="mini">
        <span class="g">🔁 ${u.duplicates} repetidas</span>
        <span class="n">🎯 ${u.missing} faltando</span>
      </div>
    </div>`;
}

// ====== Perfil de outra pessoa ======
async function renderPerson(id) {
  if (id === state.user.id) return go('profile');
  app.innerHTML = `<div class="empty">Carregando perfil…</div>`;
  const [profile, matchData] = await Promise.all([
    api(`/api/users/${id}`),
    api(`/api/users/${id}/matches`),
  ]);
  const u = profile.user;
  const match = matchData.matches.find((m) => m.user.id === id);

  app.innerHTML = `
    <button class="backlink" id="backBtn">← Voltar</button>
    <div class="card">
      <div class="match-head" style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
        <div class="avatar" style="width:46px;height:46px;background:var(--accent);color:#09090b;display:grid;place-items:center;">${esc(initials(u.name))}</div>
        <div>
          <h2 style="margin:0">${esc(u.name)}</h2>
          <div class="apt" style="color:var(--muted);font-size:13px">${esc(u.email || '')}</div>
        </div>
      </div>
      ${match ? matchBox(match) : `<div class="sub" style="margin-top:12px">Vocês não têm trocas em comum no momento.</div>`}
    </div>

    <div class="card">
      <h2>🔁 Repetidas de ${esc(u.name.split(' ')[0])} <span style="color:var(--muted);font-weight:400">(${profile.duplicates.length})</span></h2>
      <div class="sub">Figurinhas que ${esc(u.name.split(' ')[0])} tem de sobra.</div>
      ${chipList(profile.duplicates, 'give', profile.missing)}
    </div>

    <div class="card">
      <h2>🎯 Faltam para ${esc(u.name.split(' ')[0])} <span style="color:var(--muted);font-weight:400">(${profile.missing.length})</span></h2>
      <div class="sub">Figurinhas que ${esc(u.name.split(' ')[0])} ainda precisa.</div>
      ${chipList(profile.missing, 'get')}
    </div>`;

  $('#backBtn').onclick = () => go(...(state.backView || ['friends']));
}

function matchBox(m) {
  return `
    <div class="match ${m.mutual ? 'mutual' : ''}" style="margin-top:12px">
      ${m.mutual ? `<span class="tag perfect">🤝 ${m.mutual} troca${m.mutual > 1 ? 's' : ''} perfeita${m.mutual > 1 ? 's' : ''}</span>` : ''}
      <div class="block give">
        <div class="label">Você dá (suas repetidas que faltam pra ele/ela) — ${m.youGive.length}</div>
        ${m.youGive.length ? `<div class="chips">${m.youGive.map((s) => chip(s, 'give')).join('')}</div>` : `<span style="color:var(--muted);font-size:13px">nada por enquanto</span>`}
      </div>
      <div class="block get">
        <div class="label">Você recebe (repetidas dele/dela que você precisa) — ${m.youGet.length}</div>
        ${m.youGet.length ? `<div class="chips">${m.youGet.map((s) => chip(s, 'get')).join('')}</div>` : `<span style="color:var(--muted);font-size:13px">nada por enquanto</span>`}
      </div>
    </div>`;
}

function chip(s, kind = '') {
  return `<span class="chip ${kind}"><b>${s.code}</b></span>`;
}
function chipList(arr, kind, highlightAgainst) {
  if (!arr.length) return `<div style="color:var(--muted);font-size:13px">Nenhuma cadastrada.</div>`;
  return `<div class="chips">${arr.map((s) => chip(s, kind)).join('')}</div>`;
}

// ====== Trocas / cruzamentos (entre amigos) ======
async function renderMatches() {
  app.innerHTML = `<div class="empty">Procurando trocas…</div>`;
  const { matches } = await api('/api/matches');

  if (!matches.length) {
    app.innerHTML = `
      <div class="card">
        <h2>Suas trocas</h2>
        <div class="empty"><div class="big">🤷</div>
          Nenhuma troca encontrada ainda.<br/>
          Marque o que falta e o que tem repetida em <b>Meu Álbum</b>,
          e convide amigos em <b>Amigos</b>.</div>
      </div>`;
    return;
  }

  app.innerHTML = `
    <div class="card">
      <h2>Suas trocas 🔄</h2>
      <div class="sub">${matches.length} ${matches.length === 1 ? 'amigo combina' : 'amigos combinam'} com você.
        As <b style="color:var(--accent)">trocas perfeitas</b> (mão dupla) aparecem primeiro.</div>
      <div class="legend">
        <span><span class="dot give"></span>Você dá</span>
        <span><span class="dot get"></span>Você recebe</span>
      </div>
      ${matches.map(matchCard).join('')}
    </div>`;
  app.querySelectorAll('[data-goperson]').forEach((el) => {
    el.onclick = () => go('person', Number(el.dataset.goperson));
  });
}

function matchCard(m) {
  return `
    <div class="match ${m.mutual ? 'mutual' : ''}">
      <div class="head">
        <div class="avatar" style="width:36px;height:36px;background:var(--accent);color:#09090b;display:grid;place-items:center;font-size:14px">${esc(initials(m.user.name))}</div>
        <h3 data-goperson="${m.user.id}" style="cursor:pointer">${esc(m.user.name)}</h3>
        ${m.mutual ? `<span class="tag perfect">🤝 ${m.mutual} perfeita${m.mutual > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="block give">
        <div class="label">Você dá — ${m.youGive.length}</div>
        ${m.youGive.length ? `<div class="chips">${m.youGive.map((s) => chip(s, 'give')).join('')}</div>` : `<span style="color:var(--muted);font-size:13px">—</span>`}
      </div>
      <div class="block get">
        <div class="label">Você recebe — ${m.youGet.length}</div>
        ${m.youGet.length ? `<div class="chips">${m.youGet.map((s) => chip(s, 'get')).join('')}</div>` : `<span style="color:var(--muted);font-size:13px">—</span>`}
      </div>
    </div>`;
}

// ====== Convite de amizade (link ?convite=token) ======
async function processInvite() {
  const token = new URLSearchParams(location.search).get('convite');
  if (!token) return;
  history.replaceState(null, '', location.pathname); // limpa a URL
  try {
    const info = await api('/api/friends/invite/' + encodeURIComponent(token));
    if (info.isSelf) { toast('Esse é o seu próprio link de convite. 🙂'); return; }
    if (!confirm(`Aceitar amizade com ${info.inviter.name}? Os álbuns de vocês ficarão visíveis um para o outro e o app vai cruzar as figurinhas.`)) return;
    await api('/api/friends/accept', { method: 'POST', body: { token } });
    toast('Agora vocês são amigos! 🤝');
    go('friends');
  } catch (err) {
    toast(err.message, true);
  }
}

// ====== Convite de grupo (link ?grupo=token) ======
async function processGroupInvite() {
  const token = new URLSearchParams(location.search).get('grupo');
  if (!token) return;
  history.replaceState(null, '', location.pathname);
  try {
    const info = await api('/api/groups/invite/' + encodeURIComponent(token));
    if (info.isMember) { toast('Você já participa desse grupo.'); go('group', info.group.id); return; }
    if (!confirm(`Entrar no grupo "${info.group.name}"? Todos os membros verão o álbum uns dos outros e o app vai cruzar as figurinhas entre todos.`)) return;
    const { group } = await api('/api/groups/join', { method: 'POST', body: { token } });
    toast('Você entrou no grupo! 👥');
    go('group', group.id);
  } catch (err) {
    toast(err.message, true);
  }
}

// ====== Boot ======
async function boot() {
  $('#nav').classList.remove('hidden');
  $('#whoami').textContent = state.user.name;
  go('profile');
  processInvite();
  processGroupInvite();
}

async function logout() {
  if (state.dirty && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
  try { await api('/api/logout', { method: 'POST' }); } catch (e) { /* ok */ }
  state.user = null;
  state.dirty = false;
  renderAuth();
}

async function init() {
  window._go = go; // usado por onclick inline
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
