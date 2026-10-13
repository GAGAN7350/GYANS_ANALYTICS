import { create } from 'zustand';
import { Workspace } from '@/types';

interface UiState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  currentWorkspace: Workspace | null;
  
  toggleSidebar: () => void;
  toggleTheme: () => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  currentWorkspace: null,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  
  toggleTheme: () => {
    set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      return { theme: newTheme };
    });
  },
  
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
}));
