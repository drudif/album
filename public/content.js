/* =============================================================================
   content.js — TODOS OS TEXTOS DO APP EM UM SÓ LUGAR
   -----------------------------------------------------------------------------
   Edite os textos entre aspas à vontade. Depois é só salvar e dar push.

   Regras rápidas:
   • Mantenha as aspas e a vírgula no fim de cada linha.
   • Onde o texto tem algo como ${n} ou ${nome}, isso é preenchido pelo app
     (um número, um nome…). Você pode mover, mas mantenha o ${...} no texto.
   • Tags como <b>…</b> deixam a palavra em negrito. Pode manter, tirar ou mover.
   • Emojis podem ser trocados livremente.
   ============================================================================= */

window.C = {

  /* ---- Marca / topo / aba do navegador ---- */
  meta: {
    pageTitle: 'Completa Aí · Copa 2026',   // título da aba do navegador
    headerTitle: 'Completaí',                // nome no cabeçalho
    credit: {
      // linha "powered by claude code · made by fernando drudi · reporte bugs"
      prefix: 'powered by claude code · made by ',
      authorName: 'fernando drudi',
      authorUrl: 'https://www.linkedin.com/in/fdrudi/',
      reportBugs: 'reporte bugs',
    },
  },

  /* ---- Menu de navegação (depois de logado) ---- */
  nav: {
    profile: 'Meu Álbum',
    friends: 'Amigos',
    groups: 'Grupos',
    matches: 'Trocas',
    logout: 'Sair',
  },

  /* ---- Tela inicial (login / cadastro) ---- */
  home: {
    badge: '⚽ Álbum de figurinhas · Copa 2026',
    titleLine1: 'Com-',        // 1ª linha do título grande
    titleLine2: 'pletaí',      // 2ª linha do título grande
    titleFull: 'Completaí',    // usado no efeito glitch (mantenha sem quebra)
    description:
      'Cadastre suas repetidas e faltantes, convide amigos, monte seus grupos. ' +
      'O site faz o match e sugere as trocas. Crie sua conta para começar — é de graça.',

    // faixa rolando na home (pode adicionar/remover itens da lista)
    marquee: ['Bora completar o álbum', '993 figurinhas', '48 seleções', 'trocas perfeitas'],

    tabRegister: 'Criar conta',
    tabLogin: 'Já tenho conta',

    nameLabel: 'Nome',
    namePlaceholder: 'Seu nome',
    emailLabel: 'E-mail',
    emailPlaceholder: 'voce@email.com',
    passwordLabel: 'Senha',
    passwordPlaceholder: 'Mínimo 8 caracteres',
    ageText: 'Declaro que tenho <b>18 anos ou mais</b>.',
    submit: 'Entrar',

    orSeparator: 'ou',
    googleButton: 'Entrar com Google',
    googleNote: 'Ao entrar com Google, você declara ter 18 anos ou mais.',

    // avisos (toasts)
    humanCheck: 'Confirme que você é humano.',
    accountCreated: 'Conta criada! 🎉',
    welcomeBack: 'Bem-vindo de volta!',

    // faixa personalizada quando a pessoa chega por um link de convite
    inviteBannerFriend: (nome) =>
      `🤝 <b>${nome}</b> te convidou para se conectar. Crie sua conta ou entre para aceitar.`,
    inviteBannerGroup: (nome, grupo) =>
      `👥 <b>${nome}</b> te convidou para o grupo <b>"${grupo}"</b>. Crie sua conta ou entre para aceitar.`,
  },

  /* ---- Tela de convite recebido (quando a pessoa já está logada) ---- */
  invite: {
    loading: 'Abrindo convite…',
    friendTitle: (nome) => `${nome} quer se conectar`,
    friendSub: 'Se aceitar, os álbuns de vocês ficam visíveis um pro outro e o app cruza o que falta com o que sobra.',
    groupTitle: (grupo) => `Convite para o grupo "${grupo}"`,
    groupSub: (nome) => `${nome} te convidou. Todos os membros veem os álbuns uns dos outros e o app cruza as figurinhas entre todos.`,
    groupMembers: (n) => `👥 ${n} ${n === 1 ? 'membro' : 'membros'}`,
    accept: 'Aceitar convite',
    decline: 'Agora não',
    friendAccepted: 'Vocês agora são amigos! 🤝',
    friendSelf: 'Esse é o seu próprio link de convite. 🙂',
    groupJoined: 'Você entrou no grupo! 👥',
    groupAlready: 'Você já participa desse grupo.',
    error: 'Convite inválido ou expirado.',
  },

  /* ---- Convidar por email / mensagem pronta ---- */
  share: {
    friendBtn: '✉️ Convidar por email',
    groupBtn: '✉️ Convidar por email',
    title: 'Convidar',
    friendSubtitle: 'Mande o convite por email (abre seu app de email) ou copie a mensagem pronta e envie como quiser.',
    groupSubtitle: 'Chame gente pro grupo por email (abre seu app de email) ou copie a mensagem pronta e envie como quiser.',
    toLabel: 'Email de quem você quer convidar (opcional)',
    toPlaceholder: 'amigo@email.com',
    msgLabel: 'Mensagem (pode editar)',
    copyBtn: '📋 Copiar mensagem',
    sendBtn: '✉️ Enviar por email',
    copied: 'Mensagem copiada! 📋',
    opening: 'Abrindo seu e-mail… ✉️',
    // assuntos e corpos padrão — ${nome} = você, ${grupo} = nome do grupo, ${url} = link
    friendSubject: (nome) => `${nome} te convidou pro Completaí`,
    groupSubject: (nome, grupo) => `${nome} te convidou pro grupo "${grupo}" no Completaí`,
    friendMessage: (nome, url) =>
      `Oi! Sou ${nome}. Bora trocar figurinhas da Copa 2026 no Completaí?\n\n` +
      `É de graça: você cadastra suas repetidas e faltantes e o site cruza as trocas com as minhas.\n\n` +
      `Aceita meu convite por aqui:\n${url}`,
    groupMessage: (nome, grupo, url) =>
      `Oi! Sou ${nome}. Criei o grupo "${grupo}" no Completaí pra trocar figurinhas da Copa 2026.\n\n` +
      `Entra pelo link, cadastra suas repetidas e faltantes, e o site cruza as trocas entre todo mundo do grupo:\n${url}`,
  },

  /* ---- Meu Álbum (editor) ---- */
  profile: {
    title: 'Meu Álbum — Copa 2026',
    sub: 'Marque o que <b style="color:var(--get)">falta</b> (quero) e o que está ' +
         '<b style="color:var(--give)">repetida</b> (tenho de sobra). Use a busca para achar rápido.',
    legendMissing: 'Falta — preciso desta',
    legendDuplicate: 'Repetida — tenho pra trocar',
    filterPlaceholder: '🔎 Filtrar por código ou país (ex.: BRA, 07, Argentina)',
    expandAll: 'Expandir tudo',
    collapseAll: 'Recolher',
    exportBtn: '📤 Exportar meu álbum',
    undo: 'Desfazer',
    save: 'Salvar álbum',
    dirtyUnsaved: 'Alterações não salvas…',
    dirtySaved: 'Tudo salvo ✓',
    statTotal: 'no álbum',
    statMissing: 'faltando',
    statDuplicates: 'repetidas',
    loading: 'Carregando seu álbum…',
    emptyFilter: 'Nenhuma figurinha encontrada para esse filtro.',
    saved: 'Álbum salvo! ✅',
    // rótulos dos botões de cada figurinha
    stickerMissing: 'Falta',
    stickerDuplicate: 'Rep.',
    groupHead: (letra) => `Grupo ${letra}`,          // cabeçalho de grupo da Copa
    sectionCount: (marcadas, total) =>
      `${marcadas ? marcadas + ' marcadas · ' : ''}${total} fig.`,
    unsavedLeave: 'Você tem alterações não salvas no seu álbum. Sair mesmo assim?',
  },

  /* ---- Amigos ---- */
  friends: {
    loading: 'Carregando amigos…',
    inviteTitle: 'Convidar amigo',
    inviteSub: 'Mande seu link. Quando a pessoa <b>aceitar</b>, os álbuns de vocês ' +
               'ficam visíveis e o app cruza o que falta com o que sobra.',
    copyLink: 'Copiar link',
    newLink: '🔄 Novo link',
    newLinkTitle: 'Gera um link novo e invalida os antigos',
    listTitle: 'Meus amigos',
    emptyIcon: '🤝',
    empty: 'Você ainda não tem amigos por aqui.<br/>Compartilhe seu link de convite!',
    linkCopied: 'Link copiado! 📋',
    confirmNewLink: 'Gerar um link novo? Os links antigos deixam de funcionar.',
    newLinkDone: 'Novo link gerado! 🔄',
    confirmUnfriend: 'Desfazer amizade? Vocês deixam de ver o álbum um do outro.',
    unfriendDone: 'Amizade desfeita.',
    unfriendTitle: 'Desfazer amizade',
    // card de amigo
    cardDuplicates: (n) => `🔁 ${n} repetidas`,
    cardMissing: (n) => `🎯 ${n} faltando`,
  },

  /* ---- Grupos (lista + criação) ---- */
  groups: {
    loading: 'Carregando grupos…',
    createTitle: 'Criar grupo',
    createSub: 'Crie um grupo e convide quem quiser. Todos que entrarem veem os álbuns ' +
               'uns dos outros e o app cruza as figurinhas entre <b>todos</b> os membros.',
    namePlaceholder: 'Nome do grupo (ex.: Galera do trampo)',
    createBtn: 'Criar',
    listTitle: 'Meus grupos',
    empty: 'Você ainda não participa de nenhum grupo.<br/>Crie um acima ou entre por um link de convite.',
    nameRequired: 'Dê um nome ao grupo.',
    created: 'Grupo criado! 👥',
    cardMembers: (n) => `👥 ${n} ${n === 1 ? 'membro' : 'membros'}`,
    cardOwner: '👑 dono',
  },

  /* ---- Grupo (tela de um grupo) ---- */
  group: {
    loading: 'Carregando grupo…',
    back: '← Voltar para grupos',
    inviteSub: 'Convide gente pro grupo. Quem entrar vê os álbuns de todos e entra no cruzamento.',
    copyLink: 'Copiar link',
    newLink: '🔄 Novo link',
    newLinkTitle: 'Gera um link novo e invalida os antigos',
    membersTitle: 'Membros',
    deleteBtn: 'Excluir grupo',
    leaveBtn: 'Sair do grupo',
    matchesTitle: 'Trocas no grupo 🔄',
    matchesSub: 'Seu cruzamento com os outros membros. As perfeitas (mão dupla) primeiro.',
    legendGive: 'Você dá',
    legendGet: 'Você recebe',
    matchesEmpty: 'Nenhuma troca com os membros ainda.',
    linkCopied: 'Link copiado! 📋',
    confirmNewLink: 'Gerar um link novo do grupo? Os links antigos deixam de funcionar.',
    newLinkDone: 'Novo link gerado! 🔄',
    confirmDelete: 'Excluir o grupo? Isso remove todos os membros e não dá pra desfazer.',
    deleteDone: 'Grupo excluído.',
    confirmLeave: 'Sair deste grupo?',
    leaveDone: 'Você saiu do grupo.',
    confirmRemoveMember: 'Remover este membro do grupo?',
    removeMemberDone: 'Membro removido.',
    removeMemberTitle: 'Remover do grupo',
    you: ' (você)',
    ownerCrown: ' 👑',
    memberDuplicates: (n) => `🔁 ${n} repetidas`,
    memberMissing: (n) => `🎯 ${n} faltando`,
  },

  /* ---- Trocas (cruzamentos entre amigos) ---- */
  matches: {
    loading: 'Procurando trocas…',
    emptyTitle: 'Suas trocas',
    emptyIcon: '🤷',
    empty: 'Nenhuma troca encontrada ainda.<br/>Marque o que falta e o que tem repetida em ' +
           '<b>Meu Álbum</b>, e convide amigos em <b>Amigos</b>.',
    title: 'Suas trocas 🔄',
    sub: (n) => `${n} ${n === 1 ? 'amigo combina' : 'amigos combinam'} com você. ` +
                `As <b style="color:var(--accent)">trocas perfeitas</b> (mão dupla) aparecem primeiro.`,
    legendGive: 'Você dá',
    legendGet: 'Você recebe',
    perfectTag: (n) => `🤝 ${n} perfeita${n > 1 ? 's' : ''}`,
    youGive: (n) => `Você dá — ${n}`,
    youGet: (n) => `Você recebe — ${n}`,
    markTrade: '✅ Marquei a troca',
  },

  /* ---- Perfil de outra pessoa ---- */
  person: {
    loading: 'Carregando perfil…',
    back: '← Voltar',
    noMatch: 'Vocês não têm trocas em comum no momento.',
    duplicatesTitle: (nome) => `🔁 Repetidas de ${nome}`,
    duplicatesSub: (nome) => `Figurinhas que ${nome} tem de sobra.`,
    missingTitle: (nome) => `🎯 Faltam para ${nome}`,
    missingSub: (nome) => `Figurinhas que ${nome} ainda precisa.`,
    perfectTag: (n) => `🤝 ${n} troca${n > 1 ? 's' : ''} perfeita${n > 1 ? 's' : ''}`,
    youGiveLabel: (n) => `Você dá (suas repetidas que faltam pra ele/ela) — ${n}`,
    youGetLabel: (n) => `Você recebe (repetidas dele/dela que você precisa) — ${n}`,
    nothingYet: 'nada por enquanto',
    noneRegistered: 'Nenhuma cadastrada.',
  },

  /* ---- Lightbox "Marquei a troca" ---- */
  trade: {
    title: (nome) => `Marcar troca com ${nome}`,
    sub: 'Selecione o que saiu do seu álbum nesta troca. Ao confirmar, removemos esses status.',
    gotHead: '🎯 Faltantes que você recebeu',
    gaveHead: '🔁 Repetidas que você deu',
    selectAll: 'Selecionar todas',
    nothingHere: 'nada aqui',
    cancel: 'Cancelar',
    confirm: 'Confirmar troca',
    selectAtLeastOne: 'Selecione ao menos uma figurinha.',
    done: 'Troca registrada! ✅',
  },

  /* ---- Convites recebidos por link ---- */
  invites: {
    friendSelf: 'Esse é o seu próprio link de convite. 🙂',
    friendConfirm: (nome) =>
      `Aceitar amizade com ${nome}? Os álbuns de vocês ficarão visíveis um para o outro e o app vai cruzar as figurinhas.`,
    friendDone: 'Agora vocês são amigos! 🤝',
    groupAlready: 'Você já participa desse grupo.',
    groupConfirm: (nome) =>
      `Entrar no grupo "${nome}"? Todos os membros verão o álbum uns dos outros e o app vai cruzar as figurinhas entre todos.`,
    groupDone: 'Você entrou no grupo! 👥',
  },

  /* ---- Reportar bug ---- */
  bug: {
    title: 'Reportar bug',
    sub: 'Conta o que aconteceu. Ao enviar, abre seu app de e-mail com a mensagem pronta pra <b>fernando drudi</b>.',
    emailLabel: 'Seu e-mail (opcional)',
    emailPlaceholder: 'voce@email.com',
    msgLabel: 'O que rolou?',
    msgPlaceholder: 'Descreva o bug, em qual tela, o que esperava…',
    cancel: 'Cancelar',
    send: 'Enviar',
    emailSubject: 'Bug report — Completa Aí',
    needMsg: 'Descreva o bug.',
    opening: 'Abrindo seu e-mail… 📧',
    to: 'f.drudi@gmail.com',      // e-mail que recebe os reports
  },

  /* ---- Card exportável (imagem PNG) ---- */
  exportCard: {
    badge: '⚽  COPA 2026 · MEU ÁLBUM',
    titleLine1: 'ÁLBUM',
    titleLine2: 'DA COPA',
    boxMissing: 'FALTAM (QUERO)',
    boxDuplicates: 'REPETIDAS (TROCO)',
    listMissing: '🎯 FALTAM',
    listDuplicates: '🔁 REPETIDAS',
    nothingMarked: '— nada marcado —',
    footer: 'powered by claude code · made by fernando drudi',
    shareTitle: 'Meu Álbum da Copa',
    shareText: 'Minhas figurinhas: faltantes e repetidas 🔁',
    genError: 'Não consegui gerar o card.',
    done: 'Card exportado! 📤',
    fileName: 'meu-album-copa-2026.png',
  },

  /* ---- Mensagens gerais ---- */
  common: {
    logoutUnsaved: 'Há alterações não salvas. Sair mesmo assim?',
  },
};
