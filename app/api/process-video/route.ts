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
    
    // 2. Transcrição com Whisper
    console.log('[BelchiorReceitas] Transcrevendo áudio...');
    let transcricao = '';
    
    try {
      const audioFile: any = createReadStream(audioPath);
      const response = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'pt',
      });
      transcricao = response.text;
      console.log('[BelchiorReceitas] Transcrição concluída:', transcricao.substring(0, 100) + '...');
    } catch (error: any) {
      console.error('[BelchiorReceitas] Erro na transcrição:', error?.message || error);
      await cleanup();
      return NextResponse.json(
        { success: false, error: `Erro ao transcrever áudio: ${error?.message || 'Erro desconhecido'}` },
        { status: 500 }
      );
    }
    
    // 3. Organização com GPT-4o-mini (combinando descrição + transcrição)
    console.log('[BelchiorReceitas] Organizando receita com IA...');
    
    // Combinar título, descrição e transcrição
    const promptCompleto = `${metadata?.title ? `TÍTULO DO VÍDEO: ${metadata.title}\n\n` : ''}${metadata?.description ? `DESCRIÇÃO/CAPTION DO VÍDEO (geralmente contém as quantidades exatas dos ingredientes):\n${metadata.description}\n\n` : ''}ÁUDIO TRANSCRITO (geralmente contém o modo de preparo e detalhes do processo):\n${transcricao}`;
    
    console.log('[BelchiorReceitas] Prompt completo preparado:', {
      hasTitle: !!metadata?.title,
      hasDescription: !!metadata?.description,
      transcriptionLength: transcricao.length,
      totalLength: promptCompleto.length,
    });
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em organizar receitas culinárias. 

IMPORTANTE: Priorize as informações da DESCRIÇÃO/CAPTION DO VÍDEO para quantidades exatas de ingredientes, 
pois muitos criadores de conteúdo não falam as quantidades no áudio, mas colocam na descrição do vídeo.

O áudio transcrito geralmente contém o modo de preparo e detalhes do processo culinário.

Analise TODAS as informações fornecidas (título, descrição e transcrição) e extraia em formato JSON estruturado.
Retorne APENAS o JSON, sem texto adicional, sem markdown.

Formato esperado:
{
  "titulo": "Nome da receita",
  "ingredientes": [
    {"item": "2 xícaras de farinha", "categoria": "secos"},
    {"item": "3 ovos", "categoria": "proteínas"}
  ],
  "modo_preparo": [
    {"passo": 1, "instrucao": "Pré-aqueça o forno a 180°C"},
    {"passo": 2, "instrucao": "Misture os ingredientes secos"}
  ],
  "tempo_preparo": "30 minutos",
  "rendimento": "4 porções"
}

Se alguma informação não estiver disponível, use valores padrão razoáveis.`,
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

