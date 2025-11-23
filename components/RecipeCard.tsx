"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChefHat, Clock, Users, Trash2, Image as ImageIcon, Loader2, RefreshCcw, Maximize2, X } from "lucide-react";
import { Recipe } from "@/types/recipe";
import { motion } from "framer-motion";
import { useRecipeStore } from "@/lib/stores/recipeStore";
import { useToast } from "@/components/ui/use-toast";

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [hasRetriedImage, setHasRetriedImage] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const { deleteRecipe, updateRecipe } = useRecipeStore();
  const { toast } = useToast();

  useEffect(() => {
    // Reset erros quando a receita trouxer uma imagem nova
    setImageError(false);
    setHasRetriedImage(false);
    setIsImageModalOpen(false);
  }, [recipe.imageUrl]);

  useEffect(() => {
    // Nova receita, resetar visibilidade da imagem
    setShowImage(false);
    setIsImageModalOpen(false);
  }, [recipe.id]);

  const handleDelete = async () => {
    try {
      await deleteRecipe(recipe.id);
      toast({
        title: "Receita removida",
        description: `${recipe.titulo} foi removida com sucesso`,
      });
    } catch (error) {
      console.error('[BelchiorReceitas] Erro ao deletar receita:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a receita",
        variant: "destructive",
      });
    }
  };

  const handleImageError = () => {
    if (hasRetriedImage) {
      setImageError(true);
      return;
    }
    setHasRetriedImage(true);
    setImageError(true);
    handleGenerateImage();
  };

  const handleGenerateImage = async (forceFetch = false) => {
    if (isGeneratingImage) return;
    if (recipe.imageUrl && !imageError && !forceFetch) {
      setShowImage(true);
      return; // já temos imagem, apenas mostrar após clique
    }

    setIsGeneratingImage(true);
    setImageError(false);

    try {
      const response = await fetch("/api/recipe-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoUrl: recipe.videoUrl }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success || !data?.imageUrl) {
        throw new Error(data?.error || "Não foi possível buscar a capa");
      }

      await updateRecipe(recipe.id, {
        imageUrl: data.imageUrl,
        imageSource: data.imageSource,
        imageFetchedAt: data.imageFetchedAt,
      });

      toast({
        title: "Capa encontrada!",
        description: "Exibindo a imagem do vídeo.",
      });
      setIsExpanded(true);
      setShowImage(true);
    } catch (error) {
      console.error("[BelchiorReceitas] Erro ao gerar imagem:", error);
      toast({
        title: "Erro ao gerar imagem",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      layout
      whileHover={{ y: -5 }}
    >
      <Card className="bg-white hover:shadow-2xl transition-all border-2 border-stone-200 hover:border-amber-300 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400"></div>
        <CardHeader className="bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-start justify-between">
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg">
                <ChefHat className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                {recipe.titulo}
              </span>
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all hover:scale-110"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Informações básicas */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-emerald-500" />
              <span>{recipe.tempo_preparo}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-emerald-500" />
              <span>{recipe.rendimento}</span>
            </div>
          </div>

          {/* Ingredientes */}
          <div>
            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="text-amber-500">🥘</span>
              Ingredientes:
            </h4>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 space-y-2 border border-amber-200">
              {recipe.ingredientes.slice(0, isExpanded ? undefined : 3).map((ing, idx) => (
                <div key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{ing.item}</span>
                </div>
              ))}
              {!isExpanded && recipe.ingredientes.length > 3 && (
                <p className="text-xs text-amber-600 font-medium italic mt-2">
                  + {recipe.ingredientes.length - 3} ingredientes
                </p>
              )}
            </div>
          </div>

          {/* Capa da receita */}
          {showImage && recipe.imageUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-gray-700 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-orange-500" />
                  Capa do vídeo
                </h4>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {recipe.imageSource && (
                    <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">
                      {recipe.imageSource}
                    </span>
                  )}
                  {recipe.imageFetchedAt && (
                    <span>
                      Atualizado {new Date(recipe.imageFetchedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
                <img
                  src={recipe.imageUrl}
                  alt={`Capa de ${recipe.titulo}`}
                  className="w-full h-48 object-cover"
                  onError={handleImageError}
                />
                {imageError && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-sm text-gray-600">
                    Não conseguimos carregar a capa. Tente novamente.
                  </div>
                )}
                <div className="absolute top-3 right-3 flex gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full shadow"
                    onClick={() => setIsImageModalOpen(true)}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full shadow"
                    onClick={() => handleGenerateImage(true)}
                    disabled={isGeneratingImage}
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Modo de preparo (expandido) */}
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-emerald-500">👨‍🍳</span>
                Modo de Preparo:
              </h4>
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 space-y-3 border border-emerald-200">
                {recipe.modo_preparo.map((passo) => (
                  <div key={passo.passo} className="text-sm text-gray-700 flex gap-3">
                    <span className="font-bold text-emerald-600 bg-emerald-100 rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0">
                      {passo.passo}
                    </span>
                    <span className="pt-0.5">{passo.instrucao}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Ação: Gerar imagem */}
          <div className="mt-2">
            <Button
              variant="default"
              className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white shadow-lg hover:shadow-xl border-0 rounded-xl py-6 font-semibold hover:scale-[1.01]"
              onClick={() => handleGenerateImage()}
              disabled={isGeneratingImage}
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Buscando capa do vídeo...
                </>
              ) : (
                <>
                  <ImageIcon className="h-5 w-5 mr-2" />
                  Gerar imagem
                </>
              )}
            </Button>
          </div>

          {/* Botão expandir */}
          <Button
            variant="outline"
            className="w-full border-2 border-amber-300 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 transition-all font-semibold text-amber-700 hover:text-amber-800 rounded-xl py-6"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Ver menos ▲" : "Ver modo de preparo completo ▼"}
          </Button>
        </CardContent>
      </Card>

      {/* Modal de imagem em tamanho original */}
      {isImageModalOpen && recipe.imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden">
            <button
              className="absolute top-3 right-3 bg-white/80 hover:bg-white text-gray-700 rounded-full p-2 shadow"
              onClick={() => setIsImageModalOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="bg-black">
              <img
                src={recipe.imageUrl}
                alt={`Capa de ${recipe.titulo}`}
                className="w-full h-full max-h-[80vh] object-contain"
                onError={handleImageError}
              />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
