# Migração de domínio → `album-completo.com`

Domínio comprado na GoDaddy. O app **não fixa domínio em código** — tudo passa
por `PUBLIC_ORIGIN`. Então a migração é 100% configuração (DNS + dashboards).

**Arquitetura (mantida):** navegador → Cloudflare (TLS) → Worker `album-proxy`
(reescreve o Host) → Railway (`album-production-8056.up.railway.app`).

## Valores de referência

| Item | Valor |
|---|---|
| Domínio novo (apex) | `album-completo.com` |
| Subdomínio | `www.album-completo.com` |
| Alvo na Railway | `album-production-8056.up.railway.app` |
| `PUBLIC_ORIGIN` | `https://album-completo.com` |
| Google redirect URI | `https://album-completo.com/api/auth/google/callback` |
| Google JS origin | `https://album-completo.com` |
| Turnstile hostnames | `album-completo.com`, `www.album-completo.com` |
| Domínio antigo | `albumdacopa.drudi.work` (redirecionar → novo) |

---

## 1. GoDaddy → Cloudflare (nameservers)
1. Cloudflare → **Add a site** → `album-completo.com` (plano Free).
2. Copiar os **2 nameservers** que o Cloudflare mostrar.
3. GoDaddy → domínio → **Nameservers** → **Change** → **Enter my own** → colar os 2.
4. Aguardar o Cloudflare marcar a zona como **Active** (minutos a algumas horas).

## 2. Cloudflare → DNS
Criar dois registros (ambos **Proxied / nuvem laranja**):

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `album-completo.com` (`@`) | `album-production-8056.up.railway.app` | Proxied |
| CNAME | `www` | `album-completo.com` | Proxied |

SSL/TLS → modo **Full**.

## 3. Cloudflare → Worker (rotas)
O Worker `album-proxy` já existe e serve para qualquer domínio. Só adicionar rotas:
- Worker `album-proxy` → **Triggers / Routes** → Add route:
  - `album-completo.com/*`  → zona `album-completo.com`
  - `www.album-completo.com/*` → zona `album-completo.com`

Código de referência do Worker: `infra/album-proxy.worker.js` (não precisa mudar).

## 4. Railway → variável de ambiente
```
PUBLIC_ORIGIN = https://album-completo.com
```
Depois disso, **Redeploy** do serviço. (Corrige links de convite + redirect do Google.)

## 5. Google Cloud → OAuth Client
- **Authorized redirect URIs** → adicionar `https://album-completo.com/api/auth/google/callback`
- **Authorized JavaScript origins** → adicionar `https://album-completo.com`
- (manter os antigos durante a transição)

## 6. Cloudflare Turnstile → widget
- **Hostnames** → adicionar `album-completo.com` e `www.album-completo.com`.

## 7. Domínio antigo (redirect)
Cloudflare (zona `drudi.work`) → **Rules → Redirect Rules** → Create:
- Quando: `Hostname` equals `albumdacopa.drudi.work`
- Então: **Dynamic** → `concat("https://album-completo.com", http.request.uri.path)`
- Status **301**, **Preserve query string**.

## Checklist final de verificação
- [ ] `https://album-completo.com` abre a home ("Completaí").
- [ ] `www.album-completo.com` redireciona/abre.
- [ ] Cadastro/login por senha funciona (Turnstile ok).
- [ ] Login com Google funciona (redirect volta no domínio novo).
- [ ] Link de convite gerado usa `https://album-completo.com/...`.
- [ ] `albumdacopa.drudi.work` redireciona 301 pro novo.
