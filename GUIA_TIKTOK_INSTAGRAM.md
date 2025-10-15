# 🎥 Guia: TikTok e Instagram - Belchior Receitas

## ✅ Configuração Completa

### Requisitos instalados:
- ✅ yt-dlp (2025.10.14)
- ✅ pycryptodomex (para cookies)
- ✅ OpenAI API Key configurada

---

## 🔑 Como funciona?

O sistema tenta **3 métodos diferentes** automaticamente:

### 1️⃣ Sem autenticação (YouTube)
- Funciona direto para YouTube
- Não precisa de login

### 2️⃣ Com cookies do navegador (TikTok/Instagram)
- Extrai cookies do Chrome, Firefox, Edge ou Brave
- Usa sua sessão logada automaticamente

### 3️⃣ Método alternativo
- User-agent customizado
- Referer header

---

## 📋 Passo a Passo para TikTok/Instagram

### 1. Faça login no Chrome (ou Firefox/Edge)

**TikTok:**
1. Abra Chrome
2. Vá para https://tiktok.com
3. Faça login na sua conta
4. Deixe o Chrome aberto

**Instagram:**
1. Abra Chrome
2. Vá para https://instagram.com
3. Faça login na sua conta
4. Deixe o Chrome aberto

### 2. Reinicie o servidor Next.js

```bash
# Pare o servidor (Ctrl+C no terminal)
# Inicie novamente:
npm run dev
```

### 3. Teste!

1. Acesse http://localhost:3000
2. Cole uma URL do TikTok ou Instagram
3. Clique em "Processar Receita"

O sistema vai:
- ✅ Tentar sem cookies primeiro
- ✅ Se falhar, pegar cookies do Chrome
- ✅ Se falhar, tentar Firefox, Edge, Brave
- ✅ Se falhar, tentar método alternativo

---

## 🎯 URLs Suportadas

### ✅ YouTube (mais confiável)
```
https://www.youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID
```

### ⚠️ TikTok (requer login)
```
https://www.tiktok.com/@usuario/video/123456789
https://vm.tiktok.com/CODIGO
```

### ⚠️ Instagram (requer login)
```
https://www.instagram.com/reel/CODIGO/
https://www.instagram.com/p/CODIGO/
```

---

## 🔧 Troubleshooting

### ❌ Erro: "Não foi possível baixar do TikTok"

**Solução:**
1. Verifique se está logado no Chrome
2. Tente abrir o vídeo no Chrome antes
3. Reinicie o servidor Next.js
4. Tente novamente

### ❌ Erro: "Não foi possível baixar do Instagram"

**Solução:**
1. Verifique se está logado no Instagram no Chrome
2. Certifique-se de que o vídeo é público
3. Reinicie o servidor Next.js
4. Tente novamente

### ❌ Erro: "Could not find cookies"

**Solução:**
```bash
# Reinstalar pycryptodomex
pip3 install --user --break-system-packages --upgrade pycryptodomex

# Verificar instalação
python3 -c "import Cryptodome; print('OK')"
```

### ❌ Vídeo privado ou restrito

Alguns vídeos não podem ser baixados mesmo com login:
- Vídeos privados
- Vídeos com restrição de idade
- Vídeos bloqueados na sua região

**Solução:** Use vídeos públicos

---

## 💡 Dicas

### Para melhores resultados:

1. **Use vídeos curtos** (1-5 minutos)
   - Mais rápido de processar
   - Menos chance de erro

2. **Use vídeos públicos**
   - Evita problemas de permissão

3. **YouTube é mais confiável**
   - Funciona sem login
   - Menos restrições

4. **Mantenha o navegador aberto**
   - Cookies ficam válidos
   - Melhor taxa de sucesso

---

## 📊 Taxa de Sucesso Esperada

| Plataforma | Taxa de Sucesso | Requisitos |
|------------|----------------|------------|
| YouTube | ~99% | Nenhum |
| TikTok | ~70-80% | Login no Chrome |
| Instagram | ~60-70% | Login no Chrome + vídeo público |

---

## 🚀 Fluxo Completo

```
1. Usuário cola URL
   ↓
2. Sistema valida URL
   ↓
3. Tenta download sem cookies (YouTube)
   ↓ (se falhar)
4. Tenta com cookies do Chrome
   ↓ (se falhar)
5. Tenta com cookies do Firefox/Edge/Brave
   ↓ (se falhar)
6. Tenta método alternativo
   ↓ (sucesso!)
7. Transcreve com Whisper
   ↓
8. Organiza com GPT
   ↓
9. Salva receita no IndexedDB
```

---

## 🔐 Privacidade

- ✅ Cookies são lidos localmente
- ✅ Nada é enviado para servidores externos (exceto OpenAI)
- ✅ Sessões do navegador permanecem seguras
- ✅ Cookies não são salvos ou compartilhados

---

## ❓ FAQ

**P: Por que TikTok/Instagram são mais difíceis?**
R: Eles têm proteções anti-bot e requerem autenticação.

**P: Preciso ficar logado sempre?**
R: Sim, enquanto usar TikTok/Instagram. YouTube não precisa.

**P: Funciona em produção (Vercel)?**
R: YouTube funciona perfeitamente. TikTok/Instagram podem ter problemas devido à falta de cookies do navegador. Recomenda-se implementar um serviço separado para isso.

**P: Posso usar em headless/servidor sem navegador?**
R: YouTube funciona. TikTok/Instagram precisariam de cookies exportados manualmente.

---

## 🎉 Pronto para usar!

Agora você pode processar vídeos de:
- ✅ YouTube (sem login)
- ✅ TikTok (com login no Chrome)
- ✅ Instagram (com login no Chrome)

**Bom apetite! 🍳**

