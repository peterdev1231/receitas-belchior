# Guia de Deploy na Vercel

## Pré-requisitos

1. Conta na Vercel (https://vercel.com)
2. Chave da API Gemini
3. Repositório Git (GitHub, GitLab ou Bitbucket)

## Instalação do yt-dlp

**IMPORTANTE:** O yt-dlp precisa estar disponível no ambiente de execução.

### Para desenvolvimento local:

**Linux/Mac:**
```bash
# Instalar yt-dlp
pip install yt-dlp

# ou via brew (Mac)
brew install yt-dlp
```

**Windows:**
```bash
# Baixar executável de: https://github.com/yt-dlp/yt-dlp/releases
# Adicionar ao PATH do sistema
```

### Para Vercel:

A biblioteca `yt-dlp-wrap` já está configurada no projeto. Ela baixa automaticamente o binário do yt-dlp durante o build.

## Passos para Deploy

### 1. Preparar o Repositório

```bash
git init
git add .
git commit -m "Initial commit - Belchior Receitas"
git branch -M main
git remote add origin <sua-url-do-repo>
git push -u origin main
```

### 2. Conectar na Vercel

1. Acesse https://vercel.com/new
2. Importe seu repositório
3. Configure o projeto:
   - **Framework Preset:** Next.js
   - **Root Directory:** ./
   - **Build Command:** npm run build
   - **Output Directory:** .next

### 3. Configurar Variáveis de Ambiente

No painel da Vercel, adicione:

```
GEMINI_API_KEY=sua-chave-aqui
# (opcional) OPENAI_API_KEY=sk-proj-sua-chave-aqui
```

### 4. Deploy

Clique em "Deploy" e aguarde o build.

## Limitações da Vercel

### Serverless Functions

- **Timeout máximo:** 300 segundos (5 minutos) no plano Pro
- **Memória:** Configurada para 3008 MB
- **Tamanho do arquivo:** Limite de 250 MB para arquivos temporários

### Recomendações

- Vídeos muito longos (>10 minutos) podem exceder o timeout
- Use URLs diretas de vídeos quando possível
- Considere usar plano Pro da Vercel para timeouts maiores

## Troubleshooting

### Erro: "yt-dlp not found"

Verifique se `yt-dlp-wrap` está instalado corretamente:
```bash
npm install yt-dlp-wrap
```

### Erro: "Function execution timed out"

O vídeo é muito longo. Tente:
- Vídeos mais curtos (<5 minutos)
- Upgrade para plano Pro da Vercel
- Use uma solução com backend separado (Railway, Render)

### Erro: "GEMINI_API_KEY is missing"

Configure a variável `GEMINI_API_KEY` nas configurações da Vercel.

## Monitoramento

Acompanhe os logs em:
- Dashboard Vercel > Seu Projeto > Functions
- Todos os logs têm prefixo `[BelchiorReceitas]`

## Alternativas ao Deploy na Vercel

Se encontrar limitações, considere:
- **Railway:** https://railway.app (serverless com timeouts maiores)
- **Render:** https://render.com (container-based)
- **Fly.io:** https://fly.io (VMs persistentes)
