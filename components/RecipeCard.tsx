"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChefHat, Clock, Users, Trash2, Edit3 } from "lucide-react";
import { Recipe } from "@/types/recipe";
import { motion } from "framer-motion";
import { useRecipeStore } from "@/lib/stores/recipeStore";
import { useToast } from "@/components/ui/use-toast";

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { deleteRecipe } = useRecipeStore();
  const { toast } = useToast();

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
    </motion.div>
  );
}

