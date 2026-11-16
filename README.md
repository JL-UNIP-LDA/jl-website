# JL Energy — website de produção

Build estático (Astro) servido por um servidor Node sem dependências (`dist/index.mjs`).
O código-fonte vive no repositório de desenvolvimento (`web/`); este repositório recebe apenas o build.

- Início: `node dist/index.mjs` (Render: Start Command já configurado)
- Health check: `/healthz`
- Leads: todos os CTAs abrem o WhatsApp +351 910 780 549 com mensagem pré-preenchida. O site não recolhe nem guarda dados pessoais.
- Rotas antigas (`/orcamento`, `/clientes`, `/internacional`, `/blog`, `/admin`) redirecionam com 301.
- A antiga API (`/api/*`) responde 410 Gone.

Para atualizar: no repositório de desenvolvimento, `web/scripts/package-render.sh <caminho deste repo>`, commit e push.
