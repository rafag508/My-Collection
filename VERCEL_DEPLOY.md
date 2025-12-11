# 🚀 Guia de Deploy - Vercel

Este guia explica como fazer deploy do projeto para Vercel, incluindo as Serverless Functions que protegem as API keys e códigos secretos.

---

## 📋 Pré-requisitos

1. **Conta no Vercel** (grátis): [https://vercel.com/signup](https://vercel.com/signup)
2. **Git instalado** (para fazer push do código)
3. **Node.js** (opcional, apenas se quiseres testar localmente com `vercel dev`)

---

## 🎯 Método 1: Deploy via GitHub (Recomendado)

### Passo 1: Criar repositório no GitHub

1. Cria um novo repositório no GitHub (ex: `my-collection-app`)
2. Faz push do teu código:

```bash
cd Backup
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU_USERNAME/my-collection-app.git
git push -u origin main
```

### Passo 2: Conectar ao Vercel

1. Acede a [https://vercel.com/new](https://vercel.com/new)
2. Clica em **"Import Git Repository"**
3. Seleciona o teu repositório
4. O Vercel detecta automaticamente:
   - **Framework Preset:** Other
   - **Root Directory:** `Backup` (ou deixa vazio se estiveres na raiz)
   - **Output Directory:** `public`
   - **Build Command:** (deixa vazio)
   - **Install Command:** (deixa vazio)

### Passo 3: Configurar projeto

**Settings importantes:**

- **Root Directory:** Se o teu código está na pasta `Backup`, configura como `Backup`
- **Output Directory:** `public` (ou `Backup/public` se root for `Backup`)

### Passo 4: Deploy

1. Clica em **"Deploy"**
2. Aguarda alguns minutos
3. Quando terminar, recebes um URL como: `https://my-collection-app.vercel.app`

---

## 🎯 Método 2: Deploy via Vercel CLI

### Passo 1: Instalar Vercel CLI

```bash
npm install -g vercel
```

### Passo 2: Login

```bash
vercel login
```

Seguir as instruções no navegador.

### Passo 3: Deploy

```bash
cd Backup
vercel
```

Seguir as instruções:
- **Set up and deploy?** → `Y`
- **Which scope?** → Seleciona a tua conta
- **Link to existing project?** → `N` (primeira vez)
- **What's your project's name?** → (deixa default ou escolhe um nome)
- **In which directory is your code located?** → `./` (ou `Backup` se estiveres na raiz)
- **Want to override the settings?** → `N`

### Passo 4: Deploy de produção

```bash
vercel --prod
```

---

## ✅ Verificar se está tudo a funcionar

### 1. Testar API TMDB

Acede a uma página que usa TMDB (ex: `/allmovies.html`) e verifica no console do browser se não há erros.

Ou testa diretamente:

```bash
curl -X POST https://SEU_PROJETO.vercel.app/api/tmdb \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"movie/550","params":{}}'
```

### 2. Testar validação de códigos

Testa no `/login.html`:
- Tentar entrar com código guest incorreto → deve dar erro
- Tentar entrar com código guest correto → deve funcionar
- Tentar criar conta com código secreto incorreto → deve dar erro
- Tentar criar conta com código secreto correto → deve funcionar

---

## 📁 Estrutura das API Routes

As Serverless Functions estão na pasta `api/`:

```
Backup/
├── api/
│   ├── tmdb.js                  # Proxy para TMDB API
│   ├── validate-guest-code.js   # Valida código de acesso guest
│   └── validate-secret-code.js  # Valida código secreto
├── public/
│   └── ... (teu código frontend)
└── vercel.json                  # Configuração do Vercel
```

### Como funcionam:

1. **`/api/tmdb`** → Todas as chamadas ao TMDB passam por aqui
   - Frontend chama: `POST /api/tmdb` com `{ endpoint, params }`
   - Backend adiciona API key e faz request ao TMDB
   - Retorna dados ao frontend

2. **`/api/validate-guest-code`** → Valida código de acesso guest
   - Frontend chama: `POST /api/validate-guest-code` com `{ code }`
   - Backend compara com código secreto
   - Retorna `{ valid: true/false, message: "..." }`

3. **`/api/validate-secret-code`** → Valida código secreto para criar conta
   - Frontend chama: `POST /api/validate-secret-code` com `{ code }`
   - Backend compara com código secreto
   - Retorna `{ valid: true/false, message: "..." }`

---

## 🔐 Segurança

✅ **Chaves protegidas:**
- `TMDB_API_KEY` → só existe no servidor (`api/tmdb.js`)
- `GUEST_ACCESS_CODE` → só existe no servidor (`api/validate-guest-code.js`)
- `SECRET_CODE` → só existe no servidor (`api/validate-secret-code.js`)

✅ **CORS configurado:**
- Todas as APIs permitem CORS (`Access-Control-Allow-Origin: *`)
- Isso permite que o teu frontend (mesmo em domínio diferente) possa fazer requests

---

## 💰 Limites do Plano Gratuito (Hobby)

Para 3-50 utilizadores, estás bem dentro dos limites:

- **Invocações:** 1 milhão/mês → Usas ~2,250-65,000/mês ✅
- **Bandwidth (serverless):** 100 GB/mês → Usas ~0.225-3.25 GB/mês ✅
- **Duração máxima:** 50 segundos por execução → Tuas funções demoram <1s ✅

**Não tens limites de:**
- CPU-segundos
- GB-segundos de memória
- Número de projetos

---

## 🔄 Atualizações

Sempre que fizeres push para o GitHub (Método 1), o Vercel faz deploy automático.

Se usares CLI (Método 2):

```bash
cd Backup
vercel --prod
```

---

## 🐛 Troubleshooting

### Erro: "Cannot find module"

**Problema:** As APIs não estão a funcionar.

**Solução:** Verifica que:
1. A pasta `api/` está na raiz do projeto (ou na raiz configurada no Vercel)
2. Os ficheiros têm extensão `.js`
3. Cada ficheiro exporta `export default async function handler(req, res)`

### Erro: CORS

**Problema:** Erro de CORS no browser.

**Solução:** O `vercel.json` já tem headers CORS configurados. Se ainda houver problemas, verifica que o `vercel.json` está na raiz do projeto.

### Erro: 404 nas APIs

**Problema:** `/api/tmdb` retorna 404.

**Solução:** 
1. Verifica que a pasta `api/` está na raiz configurada no Vercel
2. Verifica que o Root Directory no Vercel está correto
3. Tenta fazer rebuild: Vercel Dashboard → Project → Settings → Deployments → Redeploy

---

## 📚 Recursos Úteis

- [Documentação Vercel](https://vercel.com/docs)
- [Serverless Functions Guide](https://vercel.com/docs/functions/serverless-functions)
- [Vercel CLI Reference](https://vercel.com/docs/cli)

---

## 🎉 Pronto!

Agora as tuas API keys e códigos secretos estão protegidos no servidor! 🚀

