import { create } from 'zustand';
import { getSiteSettings } from '../lib/adminApi';
import type { SiteSettings, FooterDocument } from '../lib/adminApi';
import { getFooterDocuments } from '../lib/adminApi';

interface SettingsState {
  settings: SiteSettings | null;
  footerDocs: FooterDocument[];
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettingsLocal: (updates: Partial<SiteSettings>) => void;
  setFooterDocs: (docs: FooterDocument[]) => void;
}

const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  footerDocs: [],
  loaded: false,

  loadSettings: async () => {
    try {
      const [settings, footerDocs] = await Promise.all([
        getSiteSettings(),
        getFooterDocuments(),
      ]);
      set({ settings, footerDocs, loaded: true });
    } catch (e) {
      console.error('Failed to load settings:', e);
      set({ loaded: true });
    }
  },

  updateSettingsLocal: (updates) => set((state) => ({
    settings: state.settings ? { ...state.settings, ...updates } : null,
  })),

  setFooterDocs: (docs) => set({ footerDocs: docs }),
}));

export default useSettingsStore;
