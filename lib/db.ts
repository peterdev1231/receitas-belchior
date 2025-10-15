import Dexie, { Table } from 'dexie';
import { Recipe } from '@/types/recipe';

export class RecipesDB extends Dexie {
  recipes!: Table<Recipe>;

  constructor() {
    super('BelchiorReceitasDB');
    this.version(1).stores({
      recipes: 'id, titulo, createdAt, videoUrl',
    });
  }
}

export const db = new RecipesDB();

// Fallback para LocalStorage caso IndexedDB falhe
export const localStorageBackup = {
  saveRecipe: (recipe: Recipe) => {
    try {
      const recipes = localStorageBackup.getRecipes();
      recipes.push(recipe);
      localStorage.setItem('belchior_recipes', JSON.stringify(recipes));
      console.log('[BelchiorReceitas] Receita salva no LocalStorage (fallback)');
    } catch (error) {
      console.error('[BelchiorReceitas] Erro ao salvar no LocalStorage:', error);
    }
  },
  
  getRecipes: (): Recipe[] => {
    try {
      const data = localStorage.getItem('belchior_recipes');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[BelchiorReceitas] Erro ao ler LocalStorage:', error);
      return [];
    }
  },
  
  updateRecipe: (id: string, updates: Partial<Recipe>) => {
    try {
      const recipes = localStorageBackup.getRecipes();
      const index = recipes.findIndex(r => r.id === id);
      if (index !== -1) {
        recipes[index] = { ...recipes[index], ...updates };
        localStorage.setItem('belchior_recipes', JSON.stringify(recipes));
        console.log('[BelchiorReceitas] Receita atualizada no LocalStorage (fallback)');
      }
    } catch (error) {
      console.error('[BelchiorReceitas] Erro ao atualizar LocalStorage:', error);
    }
  },
  
  deleteRecipe: (id: string) => {
    try {
      const recipes = localStorageBackup.getRecipes();
      const filtered = recipes.filter(r => r.id !== id);
      localStorage.setItem('belchior_recipes', JSON.stringify(filtered));
      console.log('[BelchiorReceitas] Receita deletada do LocalStorage (fallback)');
    } catch (error) {
      console.error('[BelchiorReceitas] Erro ao deletar do LocalStorage:', error);
    }
  },
};

