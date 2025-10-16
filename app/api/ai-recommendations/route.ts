import { NextRequest, NextResponse } from 'next/server';
import { Recipe } from '@/types/recipe';

interface AIRecommendation {
  recipe: Recipe;
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
    const prompt = `Analise as seguintes receitas e forneça insights inteligentes e recomendações personalizadas.

RECEITAS PARA ANÁLISE:
${JSON.stringify(recipesData, null, 2)}

TAREFAS:
1. Identifique os ingredientes mais usados
2. Categorize os tipos de pratos (doces, salgados, massas, pães, etc.)
3. Calcule o tempo médio de preparo
4. Gere insights interessantes sobre os padrões culinários
5. Sugira receitas similares baseadas em ingredientes em comum
6. Identifique oportunidades de variações ou melhorias

Retorne APENAS um JSON válido no seguinte formato:
{
  "totalRecipes": ${recipes.length},
  "mostUsedIngredients": ["ingrediente1", "ingrediente2", "ingrediente3"],
  "favoriteCategories": ["categoria1", "categoria2"],
  "averageTime": "tempo médio calculado",
  "recommendations": [
    {
      "recipeIndex": 0,
      "reason": "Motivo da recomendação baseado em similaridade",
      "similarity": 0.85,
      "category": "categoria do prato"
    }
  ],
  "insights": [
    "Insight interessante sobre padrões culinários",
    "Sugestão de variação ou melhoria"
  ]
}

IMPORTANTE: 
- Seja criativo mas preciso nas recomendações
- Foque em similaridade de ingredientes e técnicas
- Forneça insights úteis e acionáveis
- Mantenha o tom amigável e encorajador`;

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

    // Parsear resposta JSON
    let analysis: AIAnalysis;
    try {
      analysis = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[BelchiorReceitas] Erro ao parsear resposta da IA:', parseError);
      throw new Error('Resposta inválida da IA');
    }

    // Mapear índices das receitas para objetos completos
    if (analysis.recommendations) {
      analysis.recommendations = analysis.recommendations.map(rec => ({
        ...rec,
        recipe: recipes[rec.recipeIndex] || recipes[0],
      }));
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
