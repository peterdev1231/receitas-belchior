# Setup Local - Belchior Receitas 🍳

## Passo a passo para rodar localmente

### 1. Pré-requisitos

Certifique-se de ter instalado:
- **Node.js 18+** (https://nodejs.org)
- **npm** ou **yarn**
- **yt-dlp** (para processar vídeos)

### 2. Instalar yt-dlp

#### Linux/WSL:
```bash
sudo apt update
sudo apt install -y python3-pip
pip3 install yt-dlp

# Verificar instalação
yt-dlp --version
```

#### macOS:
```bash
brew install yt-dlp

# ou com pip
pip3 install yt-dlp
```

#### Windows:
```bash
# Instalar com pip
pip install yt-dlp

# ou baixar executável de:
# https://github.com/yt-dlp/yt-dlp/releases
# e adicionar ao PATH
```

### 3. Instalar Dependências do Projeto

```bash
# Navegar até a pasta do projeto
cd "new receitas"

# Instalar dependências
npm install
```

### 4. Configurar Variáveis de Ambiente

A chave da API Gemini já está configurada no arquivo `.env.local` (bloqueado pelo .gitignore).

**IMPORTANTE:** Nunca commite a chave da API para o Git!

### 5. Executar em Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

### 6. Testar a Aplicação

1. Cole uma URL de vídeo (YouTube, TikTok ou Instagram)
2. Clique em "Processar Receita"
3. Aguarde o processamento (pode levar 1-3 minutos)
4. Veja sua receita estruturada aparecer!

## Troubleshooting

### ❌ Erro: "yt-dlp not found"

**Solução:**
```bash
# Verificar se yt-dlp está no PATH
which yt-dlp  # Linux/Mac
where yt-dlp  # Windows

# Se não estiver, reinstalar
pip3 install --upgrade yt-dlp
```

### ❌ Erro: "GEMINI_API_KEY is missing"

**Solução:**
- Verifique se o arquivo `.env.local` existe na raiz do projeto
- Certifique-se de que a chave está no formato correto

### ❌ Erro: "Module not found"

**Solução:**
```bash
# Limpar e reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### ❌ Vídeo não baixa

**Possíveis causas:**
- URL inválida ou não suportada
- Vídeo privado ou com restrições
- Problema de rede

**Solução:**
- Teste com uma URL pública do YouTube
- Verifique sua conexão com a internet
- Veja os logs no console: `[BelchiorReceitas]`

### ❌ Transcrição falha

**Possíveis causas:**
- Problema com a API Gemini
- Arquivo de áudio muito grande
- Chave da API inválida

**Solução:**
- Verifique se a chave da API está correta
- Teste com vídeos mais curtos (<5 minutos)
- Verifique saldo da conta OpenAI

## Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Executar produção
npm run start

# Linting
npm run lint
```

## Estrutura de Arquivos

```
new receitas/
├── app/
│   ├── api/
│   │   └── process-video/     # API para processar vídeos
│   ├── layout.tsx              # Layout raiz
│   ├── page.tsx                # Página principal
│   └── globals.css             # Estilos globais
├── components/
│   ├── ui/                     # Componentes shadcn/ui
│   ├── VideoInput.tsx          # Input de URL
│   ├── ProgressCard.tsx        # Card de progresso
│   └── RecipeCard.tsx          # Card de receita
├── lib/
│   ├── stores/
│   │   └── recipeStore.ts      # Estado global (Zustand)
│   ├── db.ts                   # IndexedDB (Dexie)
│   └── utils.ts                # Funções utilitárias
├── types/
│   └── recipe.ts               # Tipos TypeScript
├── .env.local                  # Variáveis de ambiente (não commitado)
├── package.json                # Dependências
├── tailwind.config.ts          # Config Tailwind
├── tsconfig.json               # Config TypeScript
└── README.md                   # Documentação
```

## Próximos Passos

- [ ] Testar com diferentes URLs de vídeos
- [ ] Verificar armazenamento local (IndexedDB)
- [ ] Testar edição de receitas
- [ ] Exportar receitas (feature futura)
- [ ] Deploy na Vercel

## Suporte

Problemas? Verifique os logs no console do navegador e no terminal.
Todos os logs têm o prefixo `[BelchiorReceitas]` para fácil identificação.
