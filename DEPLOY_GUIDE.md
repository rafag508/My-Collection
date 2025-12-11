# 🚀 Guia de Deploy - Firebase Functions

## ⚡ Deploy Rápido

### 0. Pré-requisitos
- ✅ **Node.js v20.19.6 (LTS)** ou superior instalado
- ✅ **Firebase CLI** instalado: `npm install -g firebase-tools`
- ✅ Verificar: `node --version` deve mostrar v20.x.x

### 1. Instalar dependências
```bash
cd Backup/functions
npm install
```

### 2. Fazer login no Firebase (se necessário)
```bash
firebase login
```

### 3. Deploy das funções
```bash
# Voltar para a pasta Backup
cd ..

# Deploy de todas as funções
firebase deploy --only functions
```

### 4. Verificar status
Após o deploy, verifica no Firebase Console:
- https://console.firebase.google.com/project/my-collection-c8bf6/functions

## 📋 Funções que serão deployadas

1. ✅ **tmdbProxy** - Proxy para API TMDB (HTTP)
2. ✅ **validateGuestCode** - Valida código de acesso convidado (Callable)
3. ✅ **validateSecretCode** - Valida código secreto para criar conta (Callable)

## 🔍 Testar após deploy

### Testar TMDB Proxy:
```javascript
// Abrir console do browser e testar:
fetch('https://us-central1-my-collection-c8bf6.cloudfunctions.net/tmdbProxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    endpoint: 'movie/popular',
    params: { page: '1' }
  })
})
.then(r => r.json())
.then(d => console.log('✅ TMDB Proxy funciona!', d));
```

### Testar validação de códigos:
- Tentar entrar no modo convidado com código incorreto → deve falhar
- Tentar criar conta com código incorreto → deve falhar
- Usar códigos corretos → deve funcionar

## ⚠️ Notas Importantes

1. **Primeira vez:** Pode demorar alguns minutos (2-5 min) para fazer deploy
2. **Região:** As funções são deployadas na região `us-central1`
3. **URLs:** As URLs das funções são geradas automaticamente após deploy
4. **Custo:** Firebase Functions tem plano gratuito generoso (2 milhões de invocações/mês)

## 🐛 Problemas Comuns

### Erro: "Functions directory does not exist"
```bash
# Certifica-te que estás na pasta Backup
cd Backup
firebase deploy --only functions
```

### Erro: "npm install failed"
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
```

### Erro: "Permission denied"
```bash
# Verifica que estás logado
firebase login

# Verifica que tens permissões no projeto
firebase projects:list
```

## ✅ Após Deploy Bem-Sucedido

O frontend já está configurado e funcionará automaticamente! Não precisas de alterar mais nada no código do frontend.

