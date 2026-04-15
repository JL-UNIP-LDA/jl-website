# JL Energy Website — Render Deployment

## Como fazer deploy no Render

### 1. Sube esta pasta para GitHub
```bash
git init
git add .
git commit -m "JL Energy website production build"
git remote add origin https://github.com/SEU-USER/SEU-REPO.git
git push -u origin main
```

### 2. Cria serviço no Render
- Vai a https://render.com → New → Web Service
- Conecta o teu repositório GitHub
- **Build Command:** (deixa vazio ou: `echo ok`)
- **Start Command:** `node --enable-source-maps ./dist/index.mjs`
- **Environment:** Node

### 3. Adiciona variáveis de ambiente
Copia as variáveis do ficheiro `.env.example` para o dashboard do Render.
**IMPORTANTE:** O Render define PORT automaticamente — não o adiciones.

### 4. Deploy
Clica em "Create Web Service" e aguarda o deploy (2-3 minutos).
