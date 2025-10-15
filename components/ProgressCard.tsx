"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { ProcessStatus } from "@/types/recipe";

interface ProgressCardProps {
  status: ProcessStatus;
  message: string;
  progress: number;
}

const statusMessages: Record<ProcessStatus, string> = {
  idle: "Aguardando...",
  validating: "Validando URL do vídeo...",
  downloading: "Baixando áudio do vídeo...",
  transcribing: "Transcrevendo áudio com Whisper...",
  organizing: "Organizando receita com IA...",
  complete: "Receita pronta!",
  error: "Erro no processamento",
};

export function ProgressCard({ status, message, progress }: ProgressCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-gradient-to-br from-amber-50 via-white to-emerald-50 border-2 border-amber-300 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-gray-800">
            <div className="p-2 bg-amber-100 rounded-full">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
            <span className="text-lg">{statusMessages[status]}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Progress value={progress} className="h-4 bg-amber-100" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-semibold text-amber-700">{progress}%</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 font-light bg-white/50 p-3 rounded-lg">{message}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

