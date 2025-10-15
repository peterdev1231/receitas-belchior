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
    
    // 1. Download do áudio usando sistema híbrido
    console.log('[BelchiorReceitas] Baixando áudio...');
    
    let audioPath: string;
    let cleanup: () => Promise<void>;
    
    try {
      const result = await downloadVideoViaAPI(videoUrl);
      audioPath = result.audioPath;
      cleanup = result.cleanup;
      console.log('[BelchiorReceitas] ✅ Áudio baixado com sucesso');
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
    
    // 3. Organização com GPT-5-nano ou gpt-4o-mini
    console.log('[BelchiorReceitas] Organizando receita com IA...');
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Fallback para modelo disponível
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em organizar receitas culinárias. 
Analise a transcrição fornecida e extraia as informações em formato JSON estruturado.
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
            content: `Transcrição do vídeo de receita:\n\n${transcricao}`,
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

