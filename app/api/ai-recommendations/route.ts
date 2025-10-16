import { NextRequest, NextResponse } from 'next/server';
import { Recipe } from '@/types/recipe';

interface AIRecommendation {
  recipe?: Recipe;
  recipeIndex?: number;
  reason: string;
  similarity: number;
  category: string;
}

interface AIAnalysis {
  totalRecipes: number;
  mostUsedIngredients: string[];
  favoriteCategories: string[];
  averageTime: string;
  recommendations: AIRecommendation[];
  insights: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { recipes }: { recipes: Recipe[] } = await request.json();

    if (!recipes || recipes.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma receita fornecida' },
        { status: 400 }
      );
    }

    // Se tiver apenas 1 receita, retornar análise simples
    if (recipes.length === 1) {
      const recipe = recipes[0];
      return NextResponse.json({
        success: true,
        analysis: {
          totalRecipes: 1,
          mostUsedIngredients: recipe.ingredientes.slice(0, 5).map(ing => ing.item),
          favoriteCategories: ['Primeira receita'],
          averageTime: recipe.tempo_preparo,
          recommendations: [],
          insights: [
            'Esta é sua primeira receita! Continue adicionando mais para receber recomendações personalizadas.',
            'Adicione mais receitas para descobrir padrões nos seus ingredientes favoritos.',
            'Com mais receitas salvas, a IA poderá sugerir variações e combinações interessantes!'
          ]
        }
      });
    }

    // Verificar se a API key está disponível
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key não configurada' },
        { status: 500 }
      );
    }

    // Importar OpenAI dinamicamente
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Preparar dados das receitas para análise
    const recipesData = recipes.map(recipe => ({
      titulo: recipe.titulo,
      ingredientes: recipe.ingredientes.map(ing => ing.item),
      modo_preparo: recipe.modo_preparo.map(passo => passo.instrucao),
      tempo_preparo: recipe.tempo_preparo,
      rendimento: recipe.rendimento,
      createdAt: recipe.createdAt
    }));

    console.log(`[BelchiorReceitas] Analisando ${recipes.length} receitas com IA...`);

    // Criar prompt para análise
    const prompt = `Analise as seguintes ${recipes.length} receitas e forneça insights inteligentes.

RECEITAS PARA ANÁLISE:
${JSON.stringify(recipesData, null, 2)}

TAREFAS:
1. Identifique os ingredientes mais usados (top 3-5)
2. Categorize os tipos de pratos (doces, salgados, massas, pães, etc.)
3. Calcule o tempo médio de preparo
4. Gere 2-3 insights interessantes sobre os padrões culinários
5. ${recipes.length >= 3 ? 'Sugira receitas similares baseadas em ingredientes em comum' : 'Gere insights sobre as receitas existentes'}

Retorne APENAS um JSON válido (sem markdown, sem explicações) no seguinte formato:
{
  "totalRecipes": ${recipes.length},
  "mostUsedIngredients": ["ingrediente1", "ingrediente2", "ingrediente3"],
  "favoriteCategories": ["categoria1", "categoria2"],
  "averageTime": "tempo médio calculado",
  "recommendations": [
    ${recipes.length >= 3 ? `{
      "recipeIndex": 0,
      "reason": "Receita similar por usar ingredientes X e Y",
      "similarity": 0.85,
      "category": "categoria do prato"
    }` : ''}
  ],
  "insights": [
    "Insight interessante sobre ingredientes ou técnicas",
    "Sugestão criativa de variação",
    "Observação útil sobre as receitas"
  ]
}

IMPORTANTE: 
- Se houver menos de 3 receitas, retorne array vazio em "recommendations"
- Seja específico nos insights, mencionando ingredientes e receitas pelo nome
- Mantenha o tom amigável e encorajador
- RETORNE APENAS O JSON, SEM MARKDOWN (```json)`;


    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um chef especialista em análise culinária e recomendações personalizadas. Analise padrões em receitas e forneça insights valiosos de forma criativa e útil.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('Resposta vazia da OpenAI');
    }

    // Limpar resposta (remover markdown se existir)
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    // Parsear resposta JSON
    let analysis: AIAnalysis;
    try {
      analysis = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('[BelchiorReceitas] Erro ao parsear resposta da IA:', parseError);
      console.error('[BelchiorReceitas] Resposta recebida:', cleanedResponse.substring(0, 500));
      throw new Error('Resposta inválida da IA');
    }

    // Mapear índices das receitas para objetos completos
    if (analysis.recommendations) {
      analysis.recommendations = analysis.recommendations.map(rec => {
        const recipeIndex = rec.recipeIndex ?? 0;
        return {
          ...rec,
          recipe: recipes[recipeIndex] || recipes[0],
        };
      });
    }

    console.log('[BelchiorReceitas] ✅ Análise de IA concluída:', {
      totalRecipes: analysis.totalRecipes,
      recommendations: analysis.recommendations?.length || 0,
      insights: analysis.insights?.length || 0,
    });

    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error('[BelchiorReceitas] Erro na análise de IA:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// Endpoint GET para health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'AI Recommendations API está funcionando',
    timestamp: new Date().toISOString(),
  });
}
