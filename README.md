# Belchior Receitas 🍳

Aplicação web que transforma vídeos de receitas em receitas estruturadas usando IA.

## Tecnologias

- **Next.js 14+** com App Router
- **TailwindCSS** - Design minimalista com tons de cozinha caseira
- **OpenAI Whisper** - Transcrição de áudio
- **GPT-5-nano** - Organização inteligente de receitas
- **Dexie.js** - Armazenamento local com IndexedDB
- **Framer Motion** - Animações suaves

## Funcionalidades

✅ Processar vídeos do YouTube, TikTok e Instagram  
✅ Transcrição automática com Whisper  
✅ Organização inteligente com GPT-5-nano  
✅ Armazenamento local persistente  
✅ Interface responsiva e elegante  
✅ Animações suaves  

## Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
# Crie um arquivo .env.local com:
# OPENAI_API_KEY=sua-chave-aqui

# Executar em desenvolvimento
npm run dev
```

## Deploy na Vercel

1. Conecte seu repositório à Vercel
2. Configure a variável de ambiente `OPENAI_API_KEY`
3. Deploy automático!

## Estrutura do Projeto

```
├── app/
│   ├── api/
│   │   └── process-video/    # API route para processar vídeos
│   ├── layout.tsx             # Layout principal
│   ├── page.tsx               # Página inicial
│   └── globals.css            # Estilos globais
├── components/
│   ├── ui/                    # Componentes shadcn/ui
│   ├── VideoInput.tsx         # Input de URL
│   ├── ProgressCard.tsx       # Card de progresso
│   └── RecipeCard.tsx         # Card de receita
├── lib/
│   ├── stores/
│   │   └── recipeStore.ts     # Zustand store
│   ├── db.ts                  # Dexie/IndexedDB
│   └── utils.ts               # Utilitários
└── types/
    └── recipe.ts              # Tipos TypeScript
```

## Logs

Todos os logs são prefixados com `[BelchiorReceitas]` para fácil identificação.

## Licença

MIT

