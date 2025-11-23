"use client";

import { useEffect, useState } from "react";
import { VideoInput } from "@/components/VideoInput";
import { ProgressCard } from "@/components/ProgressCard";
import { RecipeCard } from "@/components/RecipeCard";
import { InstallPrompt } from "@/components/InstallPrompt";
import { AIRecommendations } from "@/components/AIRecommendations";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRecipeStore } from "@/lib/stores/recipeStore";
import { useToast } from "@/components/ui/use-toast";
import { ProcessStatus, Recipe } from "@/types/recipe";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, Search, Plus, X } from "lucide-react";

export default function Home() {
  const { recipes, loadRecipes, addRecipe } = useRecipeStore();
  const { toast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<ProcessStatus>("idle");
  const [processMessage, setProcessMessage] = useState("");
  const [processProgress, setProcessProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [pantryInput, setPantryInput] = useState("");
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [showSimilar, setShowSimilar] = useState(false);

  useEffect(() => {
    loadRecipes();
    console.log('[BelchiorReceitas] App inicializado');
  }, [loadRecipes]);

  const handleProcessVideo = async (url: string) => {
    setIsProcessing(true);
    setProcessStatus("validating");
    setProcessMessage("Validando URL do vídeo...");
    setProcessProgress(10);

    try {
      // Simular progresso
      setProcessStatus("downloading");
      setProcessMessage("Baixando áudio do vídeo...");
      setProcessProgress(25);

      const response = await fetch("/api/process-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoUrl: url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao processar vídeo");
      }

      setProcessStatus("transcribing");
      setProcessMessage("Transcrevendo áudio com Whisper...");
      setProcessProgress(50);

      // Aguardar um pouco para simular o progresso
      await new Promise(resolve => setTimeout(resolve, 1000));

      setProcessStatus("organizing");
      setProcessMessage("Organizando receita com IA...");
      setProcessProgress(75);

      const data = await response.json();

      if (data.success && data.recipe) {
        setProcessProgress(100);
        setProcessStatus("complete");
        setProcessMessage("Receita pronta!");

        // Adicionar receita ao store
        await addRecipe(data.recipe);

        toast({
          title: "Receita processada!",
          description: `${data.recipe.titulo} foi adicionada com sucesso`,
        });

        // Reset após 2 segundos
        setTimeout(() => {
          setIsProcessing(false);
          setProcessStatus("idle");
          setProcessProgress(0);
        }, 2000);
      } else {
        throw new Error("Resposta inválida do servidor");
      }
    } catch (error) {
      console.error("[BelchiorReceitas] Erro ao processar vídeo:", error);
      setProcessStatus("error");
      setProcessMessage(error instanceof Error ? error.message : "Erro desconhecido");
      
      toast({
        title: "Erro ao processar vídeo",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });

      setTimeout(() => {
        setIsProcessing(false);
        setProcessStatus("idle");
        setProcessProgress(0);
      }, 3000);
    }
  };

  const normalizeText = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const filteredRecipes = searchQuery.trim()
    ? recipes.filter((recipe) =>
        recipe.ingredientes.some((ing) =>
          normalizeText(ing.item).includes(normalizeText(searchQuery.trim()))
        )
      )
    : recipes;

  const pantrySuggestions = Array.from(
    new Set(
      recipes.flatMap((r) =>
        r.ingredientes.map((ing) => normalizeText(ing.item))
      )
    )
  )
    .filter((ing) => ing.includes(normalizeText(pantryInput.trim())) && pantryInput.trim())
    .slice(0, 6);

  const filteredByPantry = pantryItems.length
    ? recipes
        .map((recipe) => {
          const normalizedIngredients = recipe.ingredientes.map((ing) =>
            normalizeText(ing.item)
          );
          const matches = pantryItems.filter((item) =>
            normalizedIngredients.some((ing) => ing.includes(item))
          ).length;
          const matchAll = matches === pantryItems.length;
          return { recipe, matches, matchAll };
        })
        .filter((entry) =>
          showSimilar ? entry.matches > 0 : entry.matchAll
        )
        .sort((a, b) => {
          if (b.matches !== a.matches) return b.matches - a.matches;
          if (a.recipe.ingredientes.length !== b.recipe.ingredientes.length) {
            return a.recipe.ingredientes.length - b.recipe.ingredientes.length;
          }
          return (
            new Date(b.recipe.createdAt).getTime() -
            new Date(a.recipe.createdAt).getTime()
          );
        })
        .map((entry) => entry.recipe)
    : [];

  const addPantryItem = (value: string) => {
    const normalized = normalizeText(value.trim());
    if (!normalized) return;
    if (pantryItems.includes(normalized)) return;
    setPantryItems((prev) => [...prev, normalized]);
    setPantryInput("");
  };

  const removePantryItem = (value: string) => {
    setPantryItems((prev) => prev.filter((item) => item !== value));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50">
      {/* Header */}
      <header className="border-b border-amber-200 bg-gradient-to-r from-white via-amber-50 to-white shadow-sm">
        <div className="container mx-auto px-4 py-8">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-2xl shadow-lg overflow-hidden">
                <img 
                  src="/logo.png" 
                  alt="Belchior Receitas Logo" 
                  className="h-16 w-16 object-cover"
                />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  Belchior Receitas
                </h1>
                <p className="text-gray-600 mt-1 font-light text-sm">
                  🎥 Transforme vídeos em receitas estruturadas com IA ✨
                </p>
              </div>
            </div>
            
            {/* Botão de IA */}
            <AIRecommendations />
          </motion.div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Input de vídeo */}
        <VideoInput onProcess={handleProcessVideo} isProcessing={isProcessing} />

        {/* Busca por ingrediente */}
        {recipes.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              Suas Receitas (
              {filteredRecipes.length}
              {filteredRecipes.length !== recipes.length ? ` de ${recipes.length}` : ""})
            </h2>
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Buscar por ingrediente (ex: frango)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-xl border-2 border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-300"
              />
            </div>
          </div>
        )}

        {/* Card de progresso */}
        <AnimatePresence>
          {isProcessing && (
            <ProgressCard
              status={processStatus}
              message={processMessage}
              progress={processProgress}
            />
          )}
        </AnimatePresence>

        {/* Despensa */}
        {recipes.length > 0 && (
          <section className="bg-white/70 border border-amber-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">Modo Despensa</h3>
                <p className="text-sm text-gray-500">Informe os ingredientes que você tem para ver receitas que usem todos eles.</p>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showSimilar}
                    onChange={(e) => setShowSimilar(e.target.checked)}
                    className="h-4 w-4 text-amber-500 rounded border-gray-300"
                  />
                  Ver semelhantes (contém pelo menos 1)
                </label>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite um ingrediente e pressione Enter (ex: limão)"
                    value={pantryInput}
                    onChange={(e) => setPantryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPantryItem(pantryInput);
                      }
                    }}
                    className="rounded-xl border-2 border-amber-200 focus:border-amber-400 focus:ring-amber-300"
                  />
                  <Button
                    type="button"
                    variant="default"
                    className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
                    onClick={() => addPantryItem(pantryInput)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {pantrySuggestions.length > 0 && (
                  <div className="absolute z-10 mt-2 w-full bg-white border border-amber-200 rounded-xl shadow-lg p-2 space-y-1">
                    {pantrySuggestions.map((sug) => (
                      <button
                        key={sug}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-amber-50 text-sm text-gray-700"
                        onClick={() => addPantryItem(sug)}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {pantryItems.length > 0 && (
                <Button
                  variant="ghost"
                  className="text-sm text-amber-700 hover:text-amber-900"
                  onClick={() => setPantryItems([])}
                >
                  Limpar tudo
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {pantryItems.map((item) => (
                <Badge
                  key={item}
                  variant="secondary"
                  className="bg-amber-100 text-amber-800 px-3 py-2 rounded-full flex items-center gap-2"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removePantryItem(item)}
                    className="hover:text-amber-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>

            {pantryItems.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  {filteredByPantry.length} receita(s) encontradas
                  {showSimilar ? " (similaridade)" : " (todos os ingredientes selecionados)"}
                </div>
                {filteredByPantry.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Nenhuma receita atende esses ingredientes. Experimente remover um item ou ativar "ver semelhantes".
                  </p>
                )}
                {filteredByPantry.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                      {filteredByPantry.map((recipe) => (
                        <RecipeCard key={recipe.id} recipe={recipe} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Grid de receitas (só quando não está usando o Modo Despensa) */}
        {recipes.length > 0 && pantryItems.length === 0 && filteredRecipes.length > 0 && (
          <div>
            <div className="mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredRecipes.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Sem resultados na busca */}
        {recipes.length > 0 && pantryItems.length === 0 && filteredRecipes.length === 0 && searchQuery.trim() && !isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 bg-white/60 rounded-2xl border border-amber-200"
          >
            <ChefHat className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              Nenhuma receita com esse ingrediente
            </h3>
            <p className="text-gray-500">
              Tente outro termo ou remova a busca para ver todas as receitas.
            </p>
          </motion.div>
        )}

        {/* Empty state */}
        {recipes.length === 0 && !isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <ChefHat className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-600 mb-2">
              Nenhuma receita ainda
            </h3>
            <p className="text-gray-500 font-light">
              Cole a URL de um vídeo de receita para começar
            </p>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 mt-16 py-8 bg-gradient-to-br from-stone-50 to-amber-50">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-3">
            <p className="text-lg text-gray-700 font-medium">
              Feito com <span className="text-red-500 animate-pulse">❤️</span> por <span className="font-semibold text-amber-600">Victor Freire</span>
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <ChefHat className="h-3 w-3" />
                YouTube • TikTok • Instagram
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Install Prompt */}
      <InstallPrompt />
    </div>
  );
}
