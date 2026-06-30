# ⚽ Álbum da Copa — Copa do Mundo 2026

Webapp para um grupo de pessoas (vizinhos, amigos, colegas) trocarem
figurinhas do álbum oficial da Copa do Mundo FIFA 2026.

## O que dá pra fazer

- **Cadastro simples**: a pessoa entra com nome, e-mail e número do apartamento.
- **Meu álbum**: marca, num menu prático por seleção (ou usando a busca/filtro),
  as figurinhas que **faltam** e as que tem **repetidas**. Também dá pra
  filtrar digitando código (`BRA07`, `FWC03`, `CC10`) ou país (`Argentina`).
- **Vizinhos**: lista todo mundo cadastrado e abre o perfil de cada um.
- **Buscar figurinha**: digita um código ou país e vê **quem tem repetida pra
  oferecer** e **quem está precisando**.
- **Trocas (cruzamentos)**: o app cruza automaticamente as suas repetidas com
  o que os vizinhos precisam (e vice-versa) e lista com quem você pode trocar.
  As **trocas perfeitas** (mão dupla — você dá e recebe) aparecem primeiro e
  ganham destaque.

## Stack

- **Backend**: Node.js + Express + PostgreSQL (driver `pg`).
- **Frontend**: HTML + CSS + JavaScript puro (sem build), servido pelo próprio Express.
- **Catálogo**: 48 seleções classificadas (escudo + elenco + 18 jogadores cada,
  códigos `01–20`), seção de abertura/especiais (`FWC01–FWC19`) e seção do
  patrocinador Coca-Cola (`CC01–CC14`) — **993 figurinhas** no total, geradas em
  `src/catalog.js` e fáceis de customizar.

## Como rodar

Precisa de um PostgreSQL acessível. Aponte `DATABASE_URL` para ele — o app
cria as tabelas sozinho no primeiro boot.

```bash
npm install
export DATABASE_URL="postgres://usuario:senha@localhost:5432/album"
npm start          # http://localhost:3000
```

Para popular com vizinhos de exemplo e já ver trocas funcionando:

```bash
npm run seed       # cria Ana, Bruno, Carla e Diego
npm start
# entre em "Já tenho cadastro" com, por exemplo, ana@predio.com
```

## Estrutura

```
src/
  server.js    API REST (cadastro, perfis, busca, cruzamentos)
  db.js        Pool do PostgreSQL + schema (users, user_stickers)
  catalog.js   Catálogo de figurinhas da Copa 2026
  seed.js      Dados de demonstração
public/
  index.html   Casca do app
  styles.css   Tema (gramado/dourado)
  app.js       SPA (login, álbum, vizinhos, busca, trocas)
```

## Deploy no Railway (com Postgres gerenciado)

Os dados ficam num **PostgreSQL gerenciado**, então persistem entre deploys
e reinícios — sem depender de volume.

1. No projeto do Railway, clique em **+ New → Database → Add PostgreSQL**.
2. No serviço do app, em **Variables**, referencie a URL do banco:
   `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   (use o nome real do serviço de Postgres; o Railway oferece a referência).
3. O build usa o `Dockerfile` e roda `npm start`. O servidor escuta em
   `process.env.PORT` e **cria as tabelas no primeiro boot**.

Variáveis opcionais:

- `DATABASE_SSL=require` — força SSL (necessário só para conexões externas;
  a URL interna `*.railway.internal` não precisa).
- `PG_POOL_MAX` — tamanho máximo do pool (padrão `10`).

Para semear dados de exemplo em produção, rode `npm run seed` com a mesma
`DATABASE_URL` (ex.: pelo shell do Railway).

## Notas

- O login é leve (por e-mail, sem senha) — adequado para um grupo de confiança
  como um condomínio. Para uso público, vale adicionar autenticação com senha.
- A lista de seleções reflete os 48 países classificados para a Copa 2026.
  A numeração das figurinhas (escudo/elenco/jogadores e seções especiais) é
  um formato plausível; ajuste `src/catalog.js` se quiser casar com a numeração
  exata do álbum oficial da Panini.
