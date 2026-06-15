import { useEffect } from 'react';
import useSettingsStore from '../../store/useSettingsStore';

const HelmetManager: React.FC = () => {
  const { settings } = useSettingsStore();

  useEffect(() => {
    if (!settings) return;

    // Update document title
    if (settings.siteTitle) {
      document.title = settings.siteTitle;
    }

    // Update favicon
    if (settings.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = settings.faviconUrl;
      link.type = 'image/png'; // generic
    }
  }, [settings?.siteTitle, settings?.faviconUrl]);

  return null; // This component renders nothing
};

export default HelmetManager;
