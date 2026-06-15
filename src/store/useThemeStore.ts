import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
}

const useThemeStore = create<ThemeState>((set) => {
  const savedTheme = localStorage.getItem('theme');
  
  // Default to dark mode unless explicitly set to light
  const initialIsDark = savedTheme !== 'light';

  return {
    isDark: initialIsDark,
    toggleTheme: () => set((state) => {
      const newTheme = !state.isDark;
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      return { isDark: newTheme };
    }),
  };
});

export default useThemeStore;
