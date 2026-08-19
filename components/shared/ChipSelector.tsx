// Reusable ChipSelector component — horizontal row of selectable pill/chip options
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useHCITheme } from '@/hooks/useHCITheme';

export interface ChipOption<T extends string = string> {
  id: T;
  label: string;
  description?: string;
}

interface ChipSelectorProps<T extends string = string> {
  options: ChipOption<T>[];
  selectedId: T;
  onSelect: (id: T) => void;
  style?: ViewStyle;
  /** If true, chips take equal flex width. Otherwise they wrap naturally. */
  equalWidth?: boolean;
}

export function ChipSelector<T extends string = string>({
  options,
  selectedId,
  onSelect,
  style,
  equalWidth = false,
}: ChipSelectorProps<T>) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  return (
    <View style={[styles.chipRow, style]}>
      {options.map((item) => {
        const isSelected = selectedId === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.chip,
              equalWidth && { flex: 1 },
              {
                backgroundColor: isSelected ? colors.primaryBg : colors.surface,
                borderColor: isSelected ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              onSelect(item.id);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.chipLabel,
                {
                  color: isSelected ? colors.primary : colors.text,
                  fontSize: scaleFont(12),
                },
              ]}
            >
              {item.label}
            </Text>
            {item.description ? (
              <Text
                style={[
                  styles.chipDesc,
                  {
                    color: isSelected ? colors.primary : colors.textSecondary,
                    fontSize: scaleFont(10),
                  },
                ]}
              >
                {item.description}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginVertical: 6,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  chipLabel: {
    fontWeight: '700',
  },
  chipDesc: {
    marginTop: 2,
    fontWeight: '500',
  },
});
