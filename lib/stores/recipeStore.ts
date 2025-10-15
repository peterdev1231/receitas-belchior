import { create } from 'zustand';
import { Recipe } from '@/types/recipe';
import { db, localStorageBackup } from '@/lib/db';

interface RecipeStore {
  recipes: Recipe[];
  isLoading: boolean;
  error: string | null;
  
  loadRecipes: () => Promise<void>;
  addRecipe: (recipe: Recipe) => Promise<void>;
  updateRecipe: (id: string, updates: Partial<Recipe>) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
}

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  recipes: [],
  isLoading: false,
  error: null,
  
  loadRecipes: async () => {
    set({ isLoading: true, error: null });
    console.log('[BelchiorReceitas] Carregando receitas...');
    
    try {
      const recipes = await db.recipes.toArray();
      set({ recipes, isLoading: false });
      console.log('[BelchiorReceitas] Receitas carregadas do IndexedDB:', recipes.length);
    } catch (error) {
      console.warn('[BelchiorReceitas] Erro ao carregar do IndexedDB, usando LocalStorage:', error);
      const recipes = localStorageBackup.getRecipes();
      set({ recipes, isLoading: false });
    }
  },
  
  addRecipe: async (recipe: Recipe) => {
    console.log('[BelchiorReceitas] Adicionando receita:', recipe.titulo);
    
    try {
      await db.recipes.add(recipe);
      set({ recipes: [...get().recipes, recipe] });
      console.log('[BelchiorReceitas] Receita salva no IndexedDB');
    } catch (error) {
      console.warn('[BelchiorReceitas] Erro ao salvar no IndexedDB, usando LocalStorage:', error);
      localStorageBackup.saveRecipe(recipe);
      set({ recipes: [...get().recipes, recipe] });
    }
  },
  
  updateRecipe: async (id: string, updates: Partial<Recipe>) => {
    console.log('[BelchiorReceitas] Atualizando receita:', id);
    
    try {
      await db.recipes.update(id, updates);
      set({
        recipes: get().recipes.map(r => 
          r.id === id ? { ...r, ...updates } : r
        ),
      });
      console.log('[BelchiorReceitas] Receita atualizada no IndexedDB');
    } catch (error) {
      console.warn('[BelchiorReceitas] Erro ao atualizar no IndexedDB, usando LocalStorage:', error);
      localStorageBackup.updateRecipe(id, updates);
      set({
        recipes: get().recipes.map(r => 
          r.id === id ? { ...r, ...updates } : r
        ),
      });
    }
  },
  
  deleteRecipe: async (id: string) => {
    console.log('[BelchiorReceitas] Deletando receita:', id);
    
    try {
      await db.recipes.delete(id);
      set({ recipes: get().recipes.filter(r => r.id !== id) });
      console.log('[BelchiorReceitas] Receita deletada do IndexedDB');
    } catch (error) {
      console.warn('[BelchiorReceitas] Erro ao deletar do IndexedDB, usando LocalStorage:', error);
      localStorageBackup.deleteRecipe(id);
      set({ recipes: get().recipes.filter(r => r.id !== id) });
    }
  },
}));

