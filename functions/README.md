# Firebase Functions - Proteção de API Keys

Este diretório contém as Firebase Cloud Functions que protegem as API keys e códigos secretos.

## 📋 Instalação

1. **Instalar dependências:**
   ```bash
   cd functions
   npm install
   ```

## 🚀 Deploy

1. **Fazer login no Firebase:**
   ```bash
   firebase login
   ```

2. **Fazer deploy das funções:**
   ```bash
   firebase deploy --only functions
   ```

   Ou apenas uma função específica:
   ```bash
   firebase deploy --only functions:tmdbProxy
   firebase deploy --only functions:validateGuestCode
   firebase deploy --only functions:validateSecretCode
   ```

## 🔧 Funções Disponíveis

### 1. `tmdbProxy` (HTTP)
- **Tipo:** HTTP Request (`onRequest`)
- **URL:** `https://us-central1-my-collection-c8bf6.cloudfunctions.net/tmdbProxy`
- **Uso:** Proxy para todas as chamadas TMDB API, mantendo a API key segura no servidor
- **CORS:** Habilitado para todas as origens

### 2. `validateGuestCode` (Callable)
- **Tipo:** Callable Function (`onCall`)
- **Uso:** Valida o código de acesso ao modo convidado
- **Parâmetros:** `{ code: string }`
- **Retorno:** `{ valid: boolean, message: string }`

### 3. `validateSecretCode` (Callable)
- **Tipo:** Callable Function (`onCall`)
- **Uso:** Valida o código secreto necessário para criar conta
- **Parâmetros:** `{ code: string }`
- **Retorno:** `{ valid: boolean, message: string }`

## 🔑 Segurança

- ✅ API keys estão protegidas no servidor
- ✅ Códigos secretos não estão expostos no cliente
- ✅ Validação acontece no backend
- ✅ CORS configurado para permitir chamadas do frontend

## 📝 Notas

- As funções usam **Node.js 20** (LTS)
- O projeto Firebase é `my-collection-c8bf6`
- A região padrão é `us-central1`
- **⚠️ IMPORTANTE:** Firebase Functions suporta Node.js 18 e 20. Node.js 22/24 ainda não são suportados.

## 🐛 Debug Local

Para testar localmente:

```bash
firebase emulators:start --only functions
```

Isso iniciará um emulador local em `http://localhost:5001/my-collection-c8bf6/us-central1/`

**⚠️ IMPORTANTE:** Atualiza o `tmdbApi.js` e `loginPage.js` para usar URLs locais quando estiveres a testar localmente!

