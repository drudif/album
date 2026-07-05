// Cloudflare Worker: proxy reverso para a Railway com reescrita de Host.
//
// Por que existe: o certificado TLS de custom domain da Railway ficou travado,
// então o Cloudflare termina o TLS (Universal SSL do domínio) e este Worker
// encaminha a requisição para o app na Railway, fazendo o Host bater com o
// domínio *.up.railway.app (senão a Railway responde 404).
//
// Este MESMO Worker serve para qualquer domínio: basta apontar as rotas
// (ex.: album-completo.com/*, www.album-completo.com/*) para ele no Cloudflare.
// Você provavelmente NÃO precisa mudar nada aqui — só adicionar as rotas.

const TARGET = 'album-production-8056.up.railway.app'; // app na Railway

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const originalHost = url.host;

    // Encaminha para a Railway. Trocar o hostname da URL faz o fetch enviar
    // Host: <TARGET>, que é como a Railway roteia para o app certo.
    url.hostname = TARGET;
    url.protocol = 'https:';
    url.port = '';

    const headers = new Headers(request.headers);
    headers.set('X-Forwarded-Host', originalHost); // host público que o usuário acessou
    headers.set('X-Forwarded-Proto', 'https');

    const res = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual', // preserva os 302 do OAuth do Google
    });

    // Repassa a resposta como veio (status, headers, corpo).
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  },
};
