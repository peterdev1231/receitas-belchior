import { NextRequest, NextResponse } from 'next/server';
import { Recipe } from '@/types/recipe';
import { generateId } from '@/lib/utils';

export const maxDuration = 300; // 5 minutos
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']);
const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_RESPONSE_MIME = 'application/json';

const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  m4a: 'audio/mp4',
  mpeg: 'audio/mpeg',
  mpga: 'audio/mpeg',
  wav: 'audio/wav',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
};

const normalizeContentType = (value: string | null): string => {
  return value ? value.split(';')[0].trim() : 'application/octet-stream';
};

const parseContentLength = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const inferMimeTypeFromPath = (filePath: string, fallback?: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return AUDIO_MIME_BY_EXT[ext] || fallback || 'audio/mpeg';
};

const getGeminiModelName = (envKey: string): string => {
  return process.env[envKey] || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
};

const parseJsonResponse = <T>(raw: string): T => {
  const cleaned = raw
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slice = cleaned.slice(firstBrace, lastBrace + 1);
      return JSON.parse(slice) as T;
    }
    throw new Error('Resposta inválida da IA');
  }
};

const inferFileName = (url: string, contentType: string): string => {
  const typeToExt: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };

  let ext = typeToExt[contentType];

  if (!ext) {
    try {
      const pathname = new URL(url).pathname;
      const rawExt = pathname.split('.').pop();
      if (rawExt && rawExt.length <= 5) {
        ext = rawExt;
      }
    } catch {
      // Ignore URL parsing issues.
    }
  }

  const base = contentType.startsWith('video/') ? 'video' : 'audio';
  return `${base}.${ext || 'mp3'}`;
};

const streamResponseToFile = async (response: any, filePath: string) => {
  const body = response?.body ?? null;
  const { writeFile } = await import('node:fs/promises');

  if (!body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(filePath, buffer);
    return;
  }

  const { createWriteStream } = await import('node:fs');
  const { pipeline } = await import('node:stream/promises');

  let Readable: typeof import('node:stream').Readable | undefined;
  try {
    ({ Readable } = await import('node:stream'));
  } catch {
    Readable = undefined;
  }

  if (!Readable) {
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(filePath, buffer);
    return;
  }

  let nodeStream: NodeJS.ReadableStream | null = null;
  const readableAny: any = Readable as any;

  if (readableAny && typeof readableAny.fromWeb === 'function') {
    nodeStream = readableAny.fromWeb(body as any);
  } else if (typeof (body as any)[Symbol.asyncIterator] === 'function') {
    nodeStream = Readable.from(body as any);
  } else if (typeof (body as any).getReader === 'function') {
    nodeStream = Readable.from((async function* () {
      const reader = (body as any).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) yield value;
        }
      } finally {
        reader.releaseLock?.();
      }
    })());
  }

  if (!nodeStream) {
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(filePath, buffer);
    return;
  }

  await pipeline(nodeStream, createWriteStream(filePath));
};

const transcodeToMp3 = async (inputPath: string, outputPath: string) => {
  const { spawn } = await import('child_process');
  const { default: ffmpegPath } = await import('ffmpeg-static');

  if (!ffmpegPath) {
    throw new Error('ffmpeg não disponível para conversão de áudio');
  }

  await new Promise<void>((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-b:a', '32k',
      outputPath,
    ];
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    proc.on('error', (error) => reject(error));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg falhou (${code}): ${stderr.substring(0, 400)}`));
    });
  });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableTranscriptionError = (error: any): boolean => {
  const message = String(error?.message || '');
  const causeMessage = String(error?.cause?.message || '');
  const code = String(error?.code || error?.cause?.code || '');

  return (
    message.includes('Connection error') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    causeMessage.includes('ECONNRESET') ||
    causeMessage.includes('ETIMEDOUT') ||
    causeMessage.includes('EAI_AGAIN') ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN'
  );
};

const transcribeWithRetry = async (
  openai: any,
  createFile: () => any,
  attempts = 3
) => {
  let lastError: any;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (attempt > 1) {
        console.log(`[BelchiorReceitas] 🔁 Retry transcrição ${attempt}/${attempts}`);
      }
      return await openai.audio.transcriptions.create(
        {
          file: createFile(),
          model: 'whisper-1',
        },
        { maxRetries: 0 }
      );
    } catch (error: any) {
      lastError = error;
      if (!isRetryableTranscriptionError(error) || attempt === attempts) {
        throw error;
      }
      await sleep(500 * attempt * attempt);
    }
  }
  throw lastError;
};

const isRetryableGeminiError = (error: any): boolean => {
  const message = String(error?.message || '');
  return (
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('504') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT')
  );
};

const runGeminiWithRetry = async <T>(fn: () => Promise<T>, attempts = 2): Promise<T> => {
  let lastError: any;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (attempt > 1) {
        console.log(`[BelchiorReceitas] 🔁 Retry Gemini ${attempt}/${attempts}`);
      }
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (!isRetryableGeminiError(error) || attempt === attempts) {
        throw error;
      }
      await sleep(400 * attempt * attempt);
    }
  }
  throw lastError;
};

const geminiGenerateText = async ({
  modelName,
  systemInstruction,
  prompt,
  temperature = 0.3,
  maxOutputTokens,
  responseSchema,
}: {
  modelName: string;
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseSchema?: any;
}): Promise<string> => {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    ...(systemInstruction ? { systemInstruction } : {}),
  });

  const generationConfig: Record<string, any> = {
    temperature,
    ...(maxOutputTokens ? { maxOutputTokens } : {}),
  };

  if (responseSchema) {
    generationConfig.responseMimeType = GEMINI_RESPONSE_MIME;
    generationConfig.responseSchema = responseSchema;
  }

  const result = await runGeminiWithRetry(() =>
    model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    })
  );

  const text = result.response?.text?.();
  if (!text) {
    throw new Error('Resposta vazia do Gemini');
  }
  return text.trim();
};

let cachedRecipeSchema: any | null = null;

const getRecipeResponseSchema = async () => {
  if (cachedRecipeSchema) return cachedRecipeSchema;
  const { SchemaType } = await import('@google/generative-ai');
  cachedRecipeSchema = {
    type: SchemaType.OBJECT,
    properties: {
      titulo: { type: SchemaType.STRING },
      ingredientes: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            item: { type: SchemaType.STRING },
            categoria: { type: SchemaType.STRING },
          },
          required: ['item'],
        },
      },
      modo_preparo: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            passo: { type: SchemaType.INTEGER },
            instrucao: { type: SchemaType.STRING },
          },
          required: ['passo', 'instrucao'],
        },
      },
      tempo_preparo: { type: SchemaType.STRING },
      rendimento: { type: SchemaType.STRING },
    },
    required: ['titulo', 'ingredientes', 'modo_preparo', 'tempo_preparo', 'rendimento'],
  };
  return cachedRecipeSchema;
};

const geminiTranscribeAudio = async ({
  modelName,
  audioPath,
  mimeType,
}: {
  modelName: string;
  audioPath: string;
  mimeType: string;
}): Promise<string> => {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const { readFile } = await import('node:fs/promises');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction:
      'Você é um assistente de transcrição. Retorne apenas o texto transcrito, sem comentários e sem formatação.',
  });

  const audioBase64 = (await readFile(audioPath)).toString('base64');
  const result = await runGeminiWithRetry(() =>
    model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Transcreva o áudio a seguir e retorne somente o texto.' },
            { inlineData: { mimeType, data: audioBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
      },
    })
  );

  const text = result.response?.text?.();
  if (!text) {
    throw new Error('Transcrição vazia do Gemini');
  }
  return text.trim();
};

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

    const isTikTokUrl = /tiktok\.com|vt\.tiktok|vm\.tiktok/.test(videoUrl);
    const isInstagramUrl = /instagram\.com/.test(videoUrl);
    
    console.log('[BelchiorReceitas] URL recebida:', videoUrl);
    
    // Importações dinâmicas para evitar erros no build
    const { createReadStream } = await import('fs');
    const { downloadVideoViaAPI } = await import('@/lib/videoDownloader');

    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const useGemini = hasGeminiKey;

    if (!hasGeminiKey && !hasOpenAIKey) {
      console.error('[BelchiorReceitas] Nenhuma API key configurada');
      return NextResponse.json(
        { success: false, error: 'Configuração de API (Gemini ou OpenAI) está faltando' },
        { status: 500 }
      );
    }

    let openai: any = null;
    if (!useGemini) {
      const { default: OpenAI } = await import('openai');
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    console.log('[BelchiorReceitas] Provider IA:', useGemini ? 'gemini' : 'openai');
    
    // 1. Download do áudio e extração de metadados
    console.log('[BelchiorReceitas] Baixando áudio e extraindo metadados...');

    let audioPath: string | undefined;
    let audioUrl: string | undefined;
    let cleanup: () => Promise<void> = async () => {};
    let metadata: any = null;
    let thumbnailUrl: string | undefined;
    let thumbnailSource: string | undefined;
    const extraCleanupPaths: string[] = [];

    try {
      const result = await downloadVideoViaAPI(videoUrl);
      audioPath = result.audioPath;
      audioUrl = result.audioUrl;
      cleanup = result.cleanup;
      metadata = result.metadata;
      thumbnailUrl = result.thumbnailUrl;
      thumbnailSource = result.thumbnailSource;
      console.log('[BelchiorReceitas] ✅ Áudio obtido com sucesso');

      if (audioUrl) {
        console.log('[BelchiorReceitas] 📡 Usando URL remota para transcrição (sem arquivo local)');
      } else if (audioPath) {
        console.log('[BelchiorReceitas] 💾 Usando arquivo local para transcrição');
      }

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
      // Se tem audioUrl, fazer fetch e enviar como Buffer
      if (audioUrl) {
        console.log('[BelchiorReceitas] Fazendo download da URL e enviando para Whisper...');
        const audioResponse = await fetch(audioUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!audioResponse.ok) {
          throw new Error(`Falha ao download da URL de áudio: ${audioResponse.status}`);
        }
        const contentType = normalizeContentType(audioResponse.headers.get('content-type'));
        const contentLength = parseContentLength(audioResponse.headers.get('content-length'));
        const fileName = inferFileName(audioUrl, contentType);
        console.log('[BelchiorReceitas] Mídia remota:', {
          contentType,
          contentLength,
          fileName,
        });

        const { join } = await import('path');
        const { tmpdir } = await import('os');
        const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
        const inputPath = join(tmpdir(), `belchior-${generateId()}.${fileExt || 'media'}`);
        extraCleanupPaths.push(inputPath);

        await streamResponseToFile(audioResponse, inputPath);

        const { stat } = await import('fs/promises');
        const inputStat = await stat(inputPath);
        const isAudioOrVideo = contentType.startsWith('audio/') || contentType.startsWith('video/');
        const canUploadOriginal =
          inputStat.size <= MAX_UPLOAD_BYTES &&
          (isAudioOrVideo || SUPPORTED_EXTENSIONS.has(fileExt));

        let transcriptionPath = inputPath;
        let transcoded = false;

        const needsTranscode =
          inputStat.size > MAX_UPLOAD_BYTES ||
          (!isAudioOrVideo && !SUPPORTED_EXTENSIONS.has(fileExt));

        if (needsTranscode) {
          try {
            const outputPath = join(tmpdir(), `belchior-${generateId()}.mp3`);
            extraCleanupPaths.push(outputPath);
            await transcodeToMp3(inputPath, outputPath);
            transcriptionPath = outputPath;
            transcoded = true;
          } catch (error: any) {
            if (!canUploadOriginal) {
              throw error;
            }
            console.warn('[BelchiorReceitas] Falha ao converter áudio, usando original:', {
              message: error?.message || error,
            });
          }
        }

        const outputStat = transcriptionPath === inputPath ? inputStat : await stat(transcriptionPath);
        if (outputStat.size > MAX_UPLOAD_BYTES) {
          throw new Error('Áudio muito grande para transcrição. Use um vídeo mais curto.');
        }

        console.log('[BelchiorReceitas] Áudio pronto para transcrição:', {
          outputBytes: outputStat.size,
          transcoded,
        });

        if (useGemini) {
          const mimeType = inferMimeTypeFromPath(transcriptionPath, contentType);
          transcricao = await geminiTranscribeAudio({
            modelName: getGeminiModelName('GEMINI_TRANSCRIBE_MODEL'),
            audioPath: transcriptionPath,
            mimeType,
          });
        } else {
          const response = await transcribeWithRetry(openai, () => createReadStream(transcriptionPath));
          transcricao = response.text;
        }
      } else if (audioPath) {
        // Se tem audioPath, usar createReadStream
        console.log('[BelchiorReceitas] Enviando arquivo local para Whisper...');
        const { stat } = await import('fs/promises');
        const { join } = await import('path');
        const { tmpdir } = await import('os');

        const inputStat = await stat(audioPath);
        let transcriptionPath = audioPath;
        let transcoded = false;

        if (inputStat.size > MAX_UPLOAD_BYTES) {
          const outputPath = join(tmpdir(), `belchior-${generateId()}.mp3`);
          extraCleanupPaths.push(outputPath);
          await transcodeToMp3(audioPath, outputPath);
          transcriptionPath = outputPath;
          transcoded = true;
        }

        const outputStat = await stat(transcriptionPath);
        if (outputStat.size > MAX_UPLOAD_BYTES) {
          throw new Error('Áudio muito grande para transcrição. Use um vídeo mais curto.');
        }

        console.log('[BelchiorReceitas] Áudio pronto para transcrição:', {
          outputBytes: outputStat.size,
          transcoded,
        });

        if (useGemini) {
          const mimeType = inferMimeTypeFromPath(transcriptionPath);
          transcricao = await geminiTranscribeAudio({
            modelName: getGeminiModelName('GEMINI_TRANSCRIBE_MODEL'),
            audioPath: transcriptionPath,
            mimeType,
          });
        } else {
          const response = await transcribeWithRetry(openai, () => createReadStream(transcriptionPath));
          transcricao = response.text;
        }
      } else {
        throw new Error('Nenhuma fonte de áudio disponível');
      }
      
      // Whisper detecta automaticamente o idioma
      // Vamos inferir baseado na transcrição ou usar metadata
      idiomaDetectado = detectLanguageFromText(transcricao);
      
      console.log('[BelchiorReceitas] Transcrição concluída:', {
        idioma: idiomaDetectado,
        preview: transcricao.substring(0, 100) + '...'
      });
    } catch (error: any) {
      console.error('[BelchiorReceitas] Erro na transcrição:', {
        message: error?.message || error,
        status: error?.status,
        code: error?.code,
        type: error?.type,
        cause: error?.cause?.message || error?.cause,
      });
      await cleanup();
      if (extraCleanupPaths.length > 0) {
        const { unlink } = await import('fs/promises');
        await Promise.all(extraCleanupPaths.map((p) => unlink(p).catch(() => {})));
      }
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
      let receitaText = '';
      if (useGemini) {
        receitaText = await geminiGenerateText({
          modelName: getGeminiModelName('GEMINI_RECIPE_MODEL'),
          systemInstruction: getSystemPrompt(idiomaDetectado),
          prompt: promptCompleto,
          temperature: 0.3,
          maxOutputTokens: 2000,
          responseSchema: await getRecipeResponseSchema(),
        });
      } else {
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
        
        receitaText = completion.choices[0].message.content || '{}';
      }
      
      console.log('[BelchiorReceitas] Resposta da IA:', receitaText);
      
      // Parse do JSON
      const receitaData = parseJsonResponse<any>(receitaText);
      
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
      if (extraCleanupPaths.length > 0) {
        const { unlink } = await import('fs/promises');
        await Promise.all(extraCleanupPaths.map((p) => unlink(p).catch(() => {})));
      }
      
      return NextResponse.json({
        success: true,
        recipe,
      });
      
    } catch (error: any) {
      console.error('[BelchiorReceitas] Erro ao organizar receita:', error?.message || error);
      await cleanup();
      if (extraCleanupPaths.length > 0) {
        const { unlink } = await import('fs/promises');
        await Promise.all(extraCleanupPaths.map((p) => unlink(p).catch(() => {})));
      }
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
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
  });
}
