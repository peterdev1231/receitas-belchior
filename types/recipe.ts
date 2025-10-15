export interface Ingrediente {
  item: string;
  categoria?: string;
}

export interface Passo {
  passo: number;
  instrucao: string;
}

export interface Recipe {
  id: string;
  titulo: string;
  ingredientes: Ingrediente[];
  modo_preparo: Passo[];
  tempo_preparo: string;
  rendimento: string;
  videoUrl: string;
  createdAt: Date;
}

export type ProcessStatus = 
  | 'idle'
  | 'validating'
  | 'downloading'
  | 'transcribing'
  | 'organizing'
  | 'complete'
  | 'error';

export interface ProcessProgress {
  status: ProcessStatus;
  message: string;
  progress: number;
}

export interface ProcessResponse {
  success: boolean;
  recipe?: Recipe;
  error?: string;
}

export interface VideoMetadata {
  title?: string;
  description?: string;
  hashtags?: string[];
  duration?: number;
  platform?: 'youtube' | 'tiktok' | 'instagram';
}

