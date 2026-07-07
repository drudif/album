// Catalogo de figurinhas do album oficial da Copa do Mundo FIFA 2026.
//
// O album e composto por:
//   - Secao de abertura/especiais  -> prefixo FWC, codigos FWC01..FWC19
//   - Secao patrocinador Coca-Cola -> prefixo CC,  codigos CC01..CC14
//   - 48 selecoes participantes    -> codigos <PAIS>01..<PAIS>20 (20 cada)
//
// As selecoes refletem os 48 paises classificados para a Copa 2026 e estao
// organizadas pelos 12 grupos do sorteio oficial (Grupo A ate Grupo L).
// E facil customizar: ajuste SPECIALS, COCACOLA, TEAMS ou PLAYERS_PER_TEAM
// e todo o resto (menu, busca, cruzamentos) se adapta automaticamente.

const PLAYERS_PER_TEAM = 18; // + escudo + elenco = 20 figurinhas por selecao

// Secao LEGENDS (codigo LEG01..LEG20) — craques em destaque, acima das especiais.
// Nao sao numeradas por posicao: cada figurinha e um jogador (nome + pais).
const LEGENDS = [
  'Achraf Hakimi (Marrocos)',
  'Alphonso Davies (Canadá)',
  'Cody Gakpo (Holanda)',
  'Christian Pulisic (Estados Unidos)',
  'Cristiano Ronaldo (Portugal)',
  'Erling Haaland (Noruega)',
  'Federico Valverde (Uruguai)',
  'Florian Wirtz (Alemanha)',
  'Jérémy Doku (Bélgica)',
  'Jude Bellingham (Inglaterra)',
  'Kylian Mbappé (França)',
  'Lamine Yamal (Espanha)',
  'Lionel Messi (Argentina)',
  'Luis Díaz (Colômbia)',
  'Luka Modrić (Croácia)',
  'Mohamed Salah (Egito)',
  'Moisés Caicedo (Equador)',
  'Raúl Jiménez (México)',
  'Son Heung-min (Coreia do Sul)',
  'Vinícius Júnior (Brasil)',
];

// Secao de abertura / especiais (codigo FWC01..FWC19)
const SPECIALS = [
  'Logo oficial da Copa 2026',
  'Mascotes oficiais',
  'Taca da Copa do Mundo',
  'Bola oficial',
  'Estadio - MetLife (Nova York/Nova Jersey)',
  'Estadio - SoFi (Los Angeles)',
  'Estadio - AT&T (Dallas)',
  'Estadio - Azteca (Cidade do Mexico)',
  'Estadio - BMO Field (Toronto)',
  'Estadio - BC Place (Vancouver)',
  'Cidade-sede - Miami',
  'Cidade-sede - Atlanta',
  'Cidade-sede - Seattle',
  'Cidade-sede - Kansas City',
  'Cidade-sede - Houston',
  'Cidade-sede - Boston',
  'Cidade-sede - Filadelfia',
  'Cidade-sede - Monterrey',
  'Cidade-sede - Guadalajara',
];

// Secao do patrocinador Coca-Cola (codigo CC01..CC14)
const COCACOLA = [
  'Coca-Cola - Logo comemorativo',
  'Coca-Cola - Garrafa da Copa',
  'Coca-Cola - Taca dos Campeoes',
  'Coca-Cola - Torcida nas arquibancadas',
  'Coca-Cola - Momento do gol',
  'Coca-Cola - Fan Zone oficial',
  'Coca-Cola - Estadio iluminado',
  'Coca-Cola - Mascote & Coca',
  'Coca-Cola - Brinde da vitoria',
  'Coca-Cola - Bandeirao da galera',
  'Coca-Cola - Pin colecionavel',
  'Coca-Cola - Cartao brilhante',
  'Coca-Cola - Edicao dourada',
  'Coca-Cola - Troca premiada',
];

// 48 selecoes classificadas, organizadas pelos grupos do sorteio oficial
// da Copa 2026 (A..L). O primeiro de cada grupo e o cabeca-de-chave.
const TEAMS = [
  // Grupo A
  { code: 'MEX', name: 'Mexico', flag: '🇲🇽', group: 'A' },
  { code: 'RSA', name: 'Africa do Sul', flag: '🇿🇦', group: 'A' },
  { code: 'KOR', name: 'Coreia do Sul', flag: '🇰🇷', group: 'A' },
  { code: 'CZE', name: 'Republica Tcheca', flag: '🇨🇿', group: 'A' },
  // Grupo B
  { code: 'CAN', name: 'Canada', flag: '🇨🇦', group: 'B' },
  { code: 'SUI', name: 'Suica', flag: '🇨🇭', group: 'B' },
  { code: 'QAT', name: 'Catar', flag: '🇶🇦', group: 'B' },
  { code: 'BIH', name: 'Bosnia e Herzegovina', flag: '🇧🇦', group: 'B' },
  // Grupo C
  { code: 'BRA', name: 'Brasil', flag: '🇧🇷', group: 'C' },
  { code: 'MAR', name: 'Marrocos', flag: '🇲🇦', group: 'C' },
  { code: 'SCO', name: 'Escocia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'C' },
  { code: 'HAI', name: 'Haiti', flag: '🇭🇹', group: 'C' },
  // Grupo D
  { code: 'USA', name: 'Estados Unidos', flag: '🇺🇸', group: 'D' },
  { code: 'TUR', name: 'Turquia', flag: '🇹🇷', group: 'D' },
  { code: 'PAR', name: 'Paraguai', flag: '🇵🇾', group: 'D' },
  { code: 'AUS', name: 'Australia', flag: '🇦🇺', group: 'D' },
  // Grupo E
  { code: 'GER', name: 'Alemanha', flag: '🇩🇪', group: 'E' },
  { code: 'CIV', name: 'Costa do Marfim', flag: '🇨🇮', group: 'E' },
  { code: 'ECU', name: 'Equador', flag: '🇪🇨', group: 'E' },
  { code: 'CUW', name: 'Curacao', flag: '🇨🇼', group: 'E' },
  // Grupo F
  { code: 'NED', name: 'Holanda', flag: '🇳🇱', group: 'F' },
  { code: 'JPN', name: 'Japao', flag: '🇯🇵', group: 'F' },
  { code: 'SWE', name: 'Suecia', flag: '🇸🇪', group: 'F' },
  { code: 'TUN', name: 'Tunisia', flag: '🇹🇳', group: 'F' },
  // Grupo G
  { code: 'BEL', name: 'Belgica', flag: '🇧🇪', group: 'G' },
  { code: 'EGY', name: 'Egito', flag: '🇪🇬', group: 'G' },
  { code: 'IRN', name: 'Ira', flag: '🇮🇷', group: 'G' },
  { code: 'NZL', name: 'Nova Zelandia', flag: '🇳🇿', group: 'G' },
  // Grupo H
  { code: 'ESP', name: 'Espanha', flag: '🇪🇸', group: 'H' },
  { code: 'URU', name: 'Uruguai', flag: '🇺🇾', group: 'H' },
  { code: 'KSA', name: 'Arabia Saudita', flag: '🇸🇦', group: 'H' },
  { code: 'CPV', name: 'Cabo Verde', flag: '🇨🇻', group: 'H' },
  // Grupo I
  { code: 'FRA', name: 'Franca', flag: '🇫🇷', group: 'I' },
  { code: 'SEN', name: 'Senegal', flag: '🇸🇳', group: 'I' },
  { code: 'NOR', name: 'Noruega', flag: '🇳🇴', group: 'I' },
  { code: 'IRQ', name: 'Iraque', flag: '🇮🇶', group: 'I' },
  // Grupo J
  { code: 'ARG', name: 'Argentina', flag: '🇦🇷', group: 'J' },
  { code: 'ALG', name: 'Argelia', flag: '🇩🇿', group: 'J' },
  { code: 'AUT', name: 'Austria', flag: '🇦🇹', group: 'J' },
  { code: 'JOR', name: 'Jordania', flag: '🇯🇴', group: 'J' },
  // Grupo K
  { code: 'POR', name: 'Portugal', flag: '🇵🇹', group: 'K' },
  { code: 'COL', name: 'Colombia', flag: '🇨🇴', group: 'K' },
  { code: 'UZB', name: 'Uzbequistao', flag: '🇺🇿', group: 'K' },
  { code: 'COD', name: 'RD Congo', flag: '🇨🇩', group: 'K' },
  // Grupo L
  { code: 'ENG', name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'L' },
  { code: 'CRO', name: 'Croacia', flag: '🇭🇷', group: 'L' },
  { code: 'GHA', name: 'Gana', flag: '🇬🇭', group: 'L' },
  { code: 'PAN', name: 'Panama', flag: '🇵🇦', group: 'L' },
];

function pad(n) {
  return String(n).padStart(2, '0');
}

// Constroi o catalogo completo: lista plana de figurinhas + secoes para o menu.
export function buildCatalog() {
  const stickers = [];
  const sections = [];

  // Secao LEGENDS (LEG) — craques em destaque, primeira do album
  const legendStickers = LEGENDS.map((label, i) => ({
    code: `LEG${pad(i + 1)}`,
    label,
    section: 'Legends',
    sectionId: 'LEG',
    team: null,
  }));
  stickers.push(...legendStickers);
  sections.push({
    id: 'LEG',
    title: 'Legends',
    flag: '👑',
    group: null,
    stickers: legendStickers,
  });

  // Secao especiais (FWC)
  const specialStickers = SPECIALS.map((label, i) => ({
    code: `FWC${pad(i + 1)}`,
    label,
    section: 'FWC',
    sectionId: 'FWC',
    team: null,
  }));
  stickers.push(...specialStickers);
  sections.push({
    id: 'FWC',
    title: 'FWC',
    flag: '⭐',
    group: null,
    stickers: specialStickers,
  });

  // Secao Coca-Cola (CC)
  const cocaStickers = COCACOLA.map((label, i) => ({
    code: `CC${pad(i + 1)}`,
    label,
    section: 'Coca-Cola',
    sectionId: 'CC',
    team: null,
  }));
  stickers.push(...cocaStickers);
  sections.push({
    id: 'CC',
    title: 'Coca-Cola',
    flag: '🥤',
    group: null,
    stickers: cocaStickers,
  });

  // Secoes por selecao. Layout do album: 01 = escudo, 13 = elenco (foto do
  // time), demais numeros = jogadores. Os codigos vao de 01 a 20.
  for (const team of TEAMS) {
    const teamStickers = [];
    const add = (n, label) =>
      teamStickers.push({
        code: `${team.code}${pad(n)}`,
        label: `${team.name} - ${label}`,
        section: team.name,
        sectionId: team.code,
        team: team.code,
      });
    add(1, 'Escudo');
    add(13, 'Elenco');
    let player = 0;
    for (let n = 2; n <= PLAYERS_PER_TEAM + 2; n++) {
      if (n === 13) continue; // reservado para o elenco
      player += 1;
      add(n, `Jogador ${player}`);
    }
    teamStickers.sort((a, b) => a.code.localeCompare(b.code));
    stickers.push(...teamStickers);
    sections.push({
      id: team.code,
      title: team.name,
      flag: team.flag,
      group: team.group,
      stickers: teamStickers,
    });
  }

  const byCode = new Map(stickers.map((s) => [s.code, s]));
  return { stickers, sections, byCode, teams: TEAMS };
}

export const catalog = buildCatalog();
