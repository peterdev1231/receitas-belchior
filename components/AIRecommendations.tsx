"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { useRecipeStore } from "@/lib/stores/recipeStore";
import { useToast } from "./ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  X, 
  Clock, 
  Users, 
  ChefHat, 
  Loader2,
  Lightbulb,
  TrendingUp
} from "lucide-react";
import { Recipe } from "@/types/recipe";

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

export function AIRecommendations() {
  const { recipes } = useRecipeStore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);

  const handleOpenModal = async () => {
    if (recipes.length === 0) {
      toast({
        title: "Nenhuma receita salva",
        description: "Adicione algumas receitas primeiro para receber sugestões",
        variant: "destructive",
      });
      return;
    }

    setIsOpen(true);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai-recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipes }),
      });

      if (!response.ok) {
        throw new Error("Erro ao analisar receitas");
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (error) {
      console.error("Erro ao obter recomendações:", error);
      toast({
        title: "Erro ao analisar receitas",
        description: "Tente novamente em alguns instantes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsOpen(false);
    setAnalysis(null);
  };

  return (
    <>
      {/* Botão no Header */}
      <Button
        onClick={handleOpenModal}
        variant="outline"
        size="sm"
        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl transition-all duration-300"
        disabled={recipes.length === 0}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">IA Sugestões</span>
        <span className="sm:hidden">IA</span>
      </Button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Sugestões de IA</h2>
                      <p className="text-purple-100 text-sm">
                        Análise inteligente das suas receitas
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCloseModal}
                    className="text-white hover:bg-white/20"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Conteúdo do Modal */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto mb-4" />
                      <p className="text-gray-600">Analisando suas receitas...</p>
                      <p className="text-sm text-gray-500 mt-2">
                        A IA está identificando padrões e sugestões
                      </p>
                    </div>
                  </div>
                ) : analysis ? (
                  <div className="space-y-6">
                    {/* Estatísticas Gerais */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                        <CardContent className="p-4 text-center">
                          <ChefHat className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-blue-800">{analysis.totalRecipes}</p>
                          <p className="text-sm text-blue-600">Receitas Salvas</p>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                        <CardContent className="p-4 text-center">
                          <Clock className="h-8 w-8 text-green-600 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-green-800">{analysis.averageTime}</p>
                          <p className="text-sm text-green-600">Tempo Médio</p>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                        <CardContent className="p-4 text-center">
                          <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                          <p className="text-2xl font-bold text-purple-800">{analysis.favoriteCategories.length}</p>
                          <p className="text-sm text-purple-600">Categorias</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Insights */}
                    {analysis.insights.length > 0 && (
                      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-amber-800">
                            <Lightbulb className="h-5 w-5" />
                            Insights da IA
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {analysis.insights.map((insight, index) => (
                              <p key={index} className="text-amber-700 text-sm">
                                💡 {insight}
                              </p>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Ingredientes Mais Usados */}
                    {analysis.mostUsedIngredients.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Ingredientes Favoritos</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {analysis.mostUsedIngredients.map((ingredient, index) => (
                              <Badge key={index} variant="secondary" className="bg-purple-100 text-purple-800">
                                {ingredient}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Recomendações */}
                    {analysis.recommendations.length > 0 && (
                      <div>
                        <h3 className="text-xl font-semibold mb-4">Recomendações Personalizadas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {analysis.recommendations.map((rec, index) => (
                            <Card key={index} className="hover:shadow-lg transition-shadow">
                              <CardHeader>
                                <div className="flex items-start justify-between">
                                  <div>
                                    <CardTitle className="text-lg">{rec.recipe.titulo}</CardTitle>
                                    <Badge variant="outline" className="mt-2">
                                      {rec.category}
                                    </Badge>
                                  </div>
                                  <div className="text-right text-sm text-gray-500">
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {rec.recipe.tempo_preparo}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                      <Users className="h-3 w-3" />
                                      {rec.recipe.rendimento}
                                    </div>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm text-gray-600 mb-3">{rec.reason}</p>
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-gray-500">
                                    Similaridade: {Math.round(rec.similarity * 100)}%
                                  </div>
                                  <Button size="sm" variant="outline">
                                    Ver Receita
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
