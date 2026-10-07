import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useHCITheme } from '@/hooks/useHCITheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors, scaleFont } = useHCITheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}>
      {/* 1. Argus AI Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Argus',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="sparkles"
              size={scaleFont(21)}
              color={focused ? '#f59e0b' : '#64748b'}
            />
          ),
        }}
      />

      {/* 2. Finances & Budget Tab */}
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Finances',
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name="credit-card"
              size={scaleFont(21)}
              color={focused ? '#38bdf8' : '#64748b'}
            />
          ),
        }}
      />

      {/* 3. Life Hub Tab */}
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Hub',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="folder"
              size={scaleFont(21)}
              color={focused ? '#f59e0b' : '#64748b'}
            />
          ),
        }}
      />
    </Tabs>
  );
}

