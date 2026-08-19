import { useColorScheme as useColorSchemeCore } from 'react-native';
import { useSettingsStore } from '@/store/settingsStore';

export const useColorScheme = (): 'light' | 'dark' => {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const coreScheme = useColorSchemeCore();

  if (themeMode === 'light') return 'light';
  if (themeMode === 'dark') return 'dark';

  return (coreScheme as string) === 'unspecified' || !coreScheme ? 'dark' : (coreScheme as 'light' | 'dark');
};
