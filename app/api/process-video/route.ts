import { NextRequest, NextResponse } from 'next/server';
import { Recipe } from '@/types/recipe';
import { generateId } from '@/lib/utils';

export const maxDuration = 300; // 5 minutos
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log('[BelchiorReceitas] Iniciando processamento de vídeo');
  
  try {
    // Parse do body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('[BelchiorReceitas] Erro ao parsear JSON:', error);
      return NextResponse.json(
        { success: false, error: 'Body da requisição inválido' },
        { status: 400 }
      );
    }
    
    const { videoUrl } = body;
    
    if (!videoUrl) {
      return NextResponse.json(
        { success: false, error: 'URL do vídeo é obrigatória' },
        { status: 400 }
      );
    }
    
    console.log('[BelchiorReceitas] URL recebida:', videoUrl);
    
    // Importações dinâmicas para evitar erros no build
    const { default: OpenAI } = await import('openai');
    const { createReadStream } = await import('fs');
    const { downloadVideoViaAPI } = await import('@/lib/videoDownloader');
    
    // Instanciar OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('[BelchiorReceitas] OPENAI_API_KEY não configurada');
      return NextResponse.json(
        { success: false, error: 'Configuração da API OpenAI está faltando' },
        { status: 500 }
      );
    }
    
    // 1. Download do áudio e extração de metadados
    console.log('[BelchiorReceitas] Baixando áudio e extraindo metadados...');
    
    let audioPath: string;
    let cleanup: () => Promise<void>;
    let metadata: any = null;
    
    try {
      const result = await downloadVideoViaAPI(videoUrl);
      audioPath = result.audioPath;
      cleanup = result.cleanup;
      metadata = result.metadata;
      console.log('[BelchiorReceitas] ✅ Áudio baixado com sucesso');
      
      if (metadata) {
        console.log('[BelchiorReceitas] ✅ Metadados extraídos:', {
          hasTitle: !!metadata.title,
          hasDescription: !!metadata.description,
          descLength: metadata.description?.length || 0,
        });
      }
    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || '';
      console.error('[BelchiorReceitas] ❌ Erro ao baixar áudio:', errorMsg);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Erro ao baixar vídeo: ${errorMsg}` 
        },
        { status: 500 }
      );
    }
    
    // 2. Transcrição com Whisper (com detecção automática de idioma)
    console.log('[BelchiorReceitas] Transcrevendo áudio...');
    let transcricao = '';
    let idiomaDetectado = 'pt'; // padrão português
    
    try {
      const audioFile: any = createReadStream(audioPath);
      const response = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        // Sem 'language' para detecção automática!
      });
      transcricao = response.text;
      
      // Whisper detecta automaticamente o idioma
      // Vamos inferir baseado na transcrição ou usar metadata
      idiomaDetectado = detectLanguageFromText(transcricao);
      
      console.log('[BelchiorReceitas] Transcrição concluída:', {
        idioma: idiomaDetectado,
        preview: transcricao.substring(0, 100) + '...'
      });
    } catch (error: any) {
      console.error('[BelchiorReceitas] Erro na transcrição:', error?.message || error);
      await cleanup();
      return NextResponse.json(
        { success: false, error: `Erro ao transcrever áudio: ${error?.message || 'Erro desconhecido'}` },
        { status: 500 }
      );
    }
    
    // Função auxiliar para detectar idioma do texto
    function detectLanguageFromText(text: string): string {
      const lowerText = text.toLowerCase();
      
      // Palavras comuns em inglês
      const englishWords = ['the', 'and', 'cup', 'tablespoon', 'teaspoon', 'mix', 'add', 'bake'];
      const portugueseWords = ['de', 'com', 'para', 'xícara', 'colher', 'misture', 'adicione', 'asse'];
      const spanishWords = ['de', 'con', 'para', 'taza', 'cuchara', 'mezcle', 'añade', 'hornea'];
      
      const englishCount = englishWords.filter(word => lowerText.includes(` ${word} `)).length;
      const portugueseCount = portugueseWords.filter(word => lowerText.includes(` ${word} `)).length;
      const spanishCount = spanishWords.filter(word => lowerText.includes(` ${word} `)).length;
      
      if (englishCount > portugueseCount && englishCount > spanishCount) {
        return 'en';
      } else if (spanishCount > portugueseCount && spanishCount > englishCount) {
        return 'es';
      }
      
      return 'pt'; // padrão
    }
    
    // 3. Organização com GPT-4o-mini (combinando descrição + transcrição)
    console.log('[BelchiorReceitas] Organizando receita com IA...');
    
    // Limpar emojis da descrição para facilitar extração de quantidades
    const cleanDescription = (text: string): string => {
      if (!text) return '';
      // Remover emojis mas manter o texto
      return text
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
        .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Remove símbolos
        .replace(/\s+/g, ' ')                    // Normaliza espaços
        .trim();
    };
    
    const descricaoLimpa = cleanDescription(metadata?.description || '');
    
    // Combinar título, descrição e transcrição
    const promptCompleto = idiomaDetectado === 'en' 
      ? `${metadata?.title ? `VIDEO TITLE: ${metadata.title}\n\n` : ''}${descricaoLimpa ? `⭐ VIDEO DESCRIPTION/CAPTION - INGREDIENT QUANTITIES ARE HERE:\n${descricaoLimpa}\n\n` : ''}TRANSCRIBED AUDIO (preparation steps):\n${transcricao}`
      : `${metadata?.title ? `TÍTULO DO VÍDEO: ${metadata.title}\n\n` : ''}${descricaoLimpa ? `⭐ DESCRIÇÃO/CAPTION DO VÍDEO - QUANTIDADES DOS INGREDIENTES ESTÃO AQUI:\n${descricaoLimpa}\n\n` : ''}ÁUDIO TRANSCRITO (modo de preparo):\n${transcricao}`;
    
    console.log('[BelchiorReceitas] Prompt completo preparado:', {
      hasTitle: !!metadata?.title,
      hasDescription: !!metadata?.description,
      descriptionLength: descricaoLimpa.length,
      transcriptionLength: transcricao.length,
      totalLength: promptCompleto.length,
      idioma: idiomaDetectado,
    });
    
    // Selecionar prompt baseado no idioma detectado
    const getSystemPrompt = (lang: string): string => {
      if (lang === 'en') {
        // Prompt em inglês
        return `You are a specialized assistant in organizing cooking recipes.

CRITICAL RULES - FOLLOW EXACTLY:
1. ⭐ LOOK AT THE "VIDEO DESCRIPTION/CAPTION" SECTION - All ingredient quantities are listed there!
2. COPY the exact quantities from the description (1 cup, 1/2 cup, 2 scoops, 1 tbsp, etc.)
3. DO NOT write "to taste" if the description has a specific quantity!
4. DO NOT group ingredients - create separate items for each ingredient
5. Keep the recipe in ENGLISH - DO NOT translate to Portuguese

THE DESCRIPTION IS THE PRIMARY SOURCE - The audio is just preparation steps!

EXAMPLES - Study these carefully:

If DESCRIPTION says: "1 cup peach kombucha, 1/2 cup coconut milk, 2 scoops peach yogurt"
✅ CORRECT OUTPUT:
  - "1 cup of peach kombucha"
  - "1/2 cup of coconut milk"
  - "2 scoops of peach yogurt"

❌ WRONG OUTPUT:
  - "peach kombucha to taste" (NO! Description has quantity!)
  - "coconut milk" (NO! Missing quantity!)
  - "yogurt, milk, kombucha" (NO! Grouped ingredients!)

REMEMBER: The description ALWAYS has the quantities - extract them exactly!

INFORMATION PRIORITY:
1. VIDEO DESCRIPTION/CAPTION = MAIN SOURCE for exact ingredient quantities
2. TRANSCRIBED AUDIO = preparation steps and additional details
3. TITLE = recipe name

Analyze ALL provided information and extract in structured JSON format.
Return ONLY the JSON, no additional text, no markdown blocks.

Expected format:
{
  "titulo": "Recipe Name",
  "ingredientes": [
    {"item": "1 cup of frozen peaches", "categoria": "fruits"},
    {"item": "1/2 cup of Greek yogurt", "categoria": "dairy"},
    {"item": "1 tablespoon of honey", "categoria": "sweeteners"},
    {"item": "1/2 cup of coconut milk", "categoria": "liquids"}
  ],
  "modo_preparo": [
    {"passo": 1, "instrucao": "Add all ingredients to blender"},
    {"passo": 2, "instrucao": "Blend until smooth and creamy"}
  ],
  "tempo_preparo": "5 minutes",
  "rendimento": "2 servings"
}

IMPORTANT: 
- ALWAYS include quantities for EACH ingredient
- Keep EACH ingredient as a SEPARATE item
- Extract quantities from DESCRIPTION if available
- Keep everything in ENGLISH!`;
      } else if (lang === 'es') {
        // Prompt em espanhol
        return `Eres un asistente especializado en organizar recetas de cocina.

REGLAS CRÍTICAS:
1. Use EXACTAMENTE las cantidades de la DESCRIPCIÓN/CAPTION DEL VIDEO
2. NO adaptes, conviertas o modifiques las cantidades
3. NO agrupe ingredientes - lista CADA UNO por separado con su cantidad
4. Mantén la receta en ESPAÑOL

Retorna SOLO el JSON, sin texto adicional.

Formato esperado:
{
  "titulo": "Nombre de la receta",
  "ingredientes": [
    {"item": "500g de harina", "categoria": "secos"}
  ],
  "modo_preparo": [
    {"passo": 1, "instrucao": "Precalienta el horno a 230°C"}
  ],
  "tempo_preparo": "30 minutos",
  "rendimento": "8 porciones"
}`;
      } else {
        // Prompt em português (padrão)
        return `Você é um assistente especializado em organizar receitas culinárias. 

REGRAS CRÍTICAS:
1. Use EXATAMENTE as quantidades e medidas da DESCRIÇÃO/CAPTION DO VÍDEO
2. NÃO adapte, converta ou modifique quantidades
3. NÃO agrupe ingredientes - liste CADA UM separadamente com sua quantidade
4. Se a descrição diz "200g de calabresa" e "200g de mussarela", crie DOIS itens separados

EXEMPLOS DO QUE NÃO FAZER:
❌ ERRADO: "recheio de calabresa, mussarela, cheiro verde"
✅ CERTO: "200g de calabresa ralada", "200g de mussarela ralada", "cheiro verde a gosto"

❌ ERRADO: "4 xícaras de farinha" (quando a descrição diz 500g)
✅ CERTO: "500g de farinha de trigo"

PRIORIDADE DE INFORMAÇÕES:
1. DESCRIÇÃO/CAPTION DO VÍDEO = quantidades exatas (cada ingrediente separado)
2. ÁUDIO TRANSCRITO = modo de preparo
3. TÍTULO = nome da receita

Analise TODAS as informações e extraia em formato JSON estruturado.
Retorne APENAS o JSON, sem texto adicional, sem markdown.

Formato esperado:
{
  "titulo": "Nome da receita",
  "ingredientes": [
    {"item": "500g de farinha de trigo", "categoria": "secos"},
    {"item": "240ml de água morna", "categoria": "líquidos"},
    {"item": "200g de calabresa ralada", "categoria": "recheio"},
    {"item": "200g de mussarela ralada", "categoria": "recheio"}
  ],
  "modo_preparo": [
    {"passo": 1, "instrucao": "Pré-aqueça o forno a 230°C"},
    {"passo": 2, "instrucao": "Misture os ingredientes secos"}
  ],
  "tempo_preparo": "30 minutos",
  "rendimento": "8 porções"
}

IMPORTANTE: Mantenha CADA ingrediente como um item SEPARADO com sua quantidade EXATA!`;
      }
    };
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: getSystemPrompt(idiomaDetectado),
          },
          {
            role: 'user',
            content: promptCompleto,
          },
        ],
        temperature: 0.3,
      });
      
      let receitaText = completion.choices[0].message.content || '{}';
      console.log('[BelchiorReceitas] Resposta da IA:', receitaText);
      
      // Remover markdown se existir
      receitaText = receitaText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Parse do JSON
      const receitaData = JSON.parse(receitaText);
      
      const recipe: Recipe = {
        id: generateId(),
        titulo: receitaData.titulo || 'Receita sem título',
        ingredientes: receitaData.ingredientes || [],
        modo_preparo: receitaData.modo_preparo || [],
        tempo_preparo: receitaData.tempo_preparo || 'Não especificado',
        rendimento: receitaData.rendimento || 'Não especificado',
        videoUrl,
        createdAt: new Date(),
        idioma: idiomaDetectado, // 'pt', 'en', 'es', etc.
      };
      
      console.log('[BelchiorReceitas] Receita organizada:', recipe.titulo);
      
      // Limpar arquivo temporário
      await cleanup();
      
      return NextResponse.json({
        success: true,
        recipe,
      });
      
    } catch (error: any) {
      console.error('[BelchiorReceitas] Erro ao organizar receita:', error?.message || error);
      await cleanup();
      return NextResponse.json(
        { success: false, error: `Erro ao processar receita: ${error?.message || 'Erro desconhecido'}` },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('[BelchiorReceitas] Erro geral:', error?.message || error);
    return NextResponse.json(
      { success: false, error: `Erro interno: ${error?.message || 'Erro desconhecido'}` },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Belchior Receitas API está funcionando',
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  });
}

