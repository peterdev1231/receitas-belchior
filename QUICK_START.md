# Quick Start - Belchior Receitas 🍳

## 🚀 Começar Agora

### 1️⃣ Instalar yt-dlp (necessário para baixar vídeos)

**Linux/WSL:**
```bash
pip3 install yt-dlp
```

**macOS:**
```bash
brew install yt-dlp
```

**Windows:**
```bash
pip install yt-dlp
```

### 2️⃣ Instalar dependências (já feito ✅)

```bash
npm install
```

### 3️⃣ Rodar o servidor de desenvolvimento

```bash
npm run dev
```

### 4️⃣ Abrir no navegador

http://localhost:3000

### 5️⃣ Testar!

Cole uma URL de vídeo de receita (YouTube, TikTok, Instagram) e clique em "Processar Receita"

## ✅ Build Status

- ✅ Dependências instaladas (209 packages)
- ✅ Build de produção funcionando
- ✅ TypeScript sem erros
- ✅ Linting sem erros

## 📦 Próximo Passo: Deploy na Vercel

1. Criar repositório no GitHub
2. Conectar na Vercel
3. Adicionar variável `GEMINI_API_KEY`
4. Deploy! 🚀

Veja mais detalhes em `DEPLOYMENT.md`

## 🔑 API Key

A chave do Gemini já está configurada no `.env.local`:
- Modelo padrão: **gemini-3-flash-preview**
- (Opcional) `GEMINI_TRANSCRIBE_MODEL` e `GEMINI_RECIPE_MODEL`

## 📚 Documentação

- `README.md` - Visão geral do projeto
- `SETUP.md` - Guia completo de instalação
- `DEPLOYMENT.md` - Guia de deploy na Vercel

## ❓ Problemas?

Verifique os logs com prefixo `[BelchiorReceitas]` no console do navegador e no terminal.

## 🎯 Features

✅ Processar vídeos do YouTube, TikTok, Instagram  
✅ Transcrição automática (Gemini)  
✅ Organização inteligente (Gemini)  
✅ Armazenamento local (IndexedDB)  
✅ Design responsivo e minimalista  
✅ Animações suaves (Framer Motion)  
