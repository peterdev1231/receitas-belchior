"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Loader2 } from "lucide-react";
import { validateVideoUrl } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface VideoInputProps {
  onProcess: (url: string) => void;
  isProcessing: boolean;
}

export function VideoInput({ onProcess, isProcessing }: VideoInputProps) {
  const [url, setUrl] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: "URL inválida",
        description: "Por favor, insira uma URL de vídeo",
        variant: "destructive",
      });
      return;
    }

    if (!validateVideoUrl(url)) {
      toast({
        title: "URL não suportada",
        description: "Insira uma URL válida do YouTube, TikTok ou Instagram",
        variant: "destructive",
      });
      return;
    }

    console.log('[BelchiorReceitas] Processando URL:', url);
    onProcess(url);
  };

  return (
    <Card className="bg-white border-amber-200 shadow-lg hover:shadow-xl transition-shadow">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <Input
            type="url"
            placeholder="✨ Cole a URL do vídeo (YouTube, TikTok, Instagram...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isProcessing}
            className="flex-1 bg-white border-2 border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-300 rounded-xl px-4 py-6 text-base transition-all"
          />
          <Button
            type="submit"
            disabled={isProcessing}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold transition-all hover:scale-105 shadow-md hover:shadow-lg rounded-xl px-8 py-6"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Processar Receita
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

