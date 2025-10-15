"use client";

import { useEffect, useState } from "react";
import { VideoInput } from "@/components/VideoInput";
import { ProgressCard } from "@/components/ProgressCard";
import { RecipeCard } from "@/components/RecipeCard";
import { useRecipeStore } from "@/lib/stores/recipeStore";
import { useToast } from "@/components/ui/use-toast";
import { ProcessStatus, Recipe } from "@/types/recipe";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat } from "lucide-react";

export default function Home() {
  const { recipes, loadRecipes, addRecipe } = useRecipeStore();
  const { toast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<ProcessStatus>("idle");
  const [processMessage, setProcessMessage] = useState("");
  const [processProgress, setProcessProgress] = useState(0);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50">
      {/* Header */}
      <header className="border-b border-amber-200 bg-gradient-to-r from-white via-amber-50 to-white shadow-sm">
        <div className="container mx-auto px-4 py-8">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4"
          >
            <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl shadow-lg">
              <ChefHat className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Belchior Receitas
              </h1>
              <p className="text-gray-600 mt-1 font-light text-sm">
                🎥 Transforme vídeos em receitas estruturadas com IA ✨
              </p>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Input de vídeo */}
        <VideoInput onProcess={handleProcessVideo} isProcessing={isProcessing} />

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

        {/* Grid de receitas */}
        {recipes.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              Suas Receitas ({recipes.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {recipes.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </AnimatePresence>
            </div>
          </div>
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
    </div>
  );
}

