import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';

interface UnconfirmedAlertsBannerProps {
  unconfirmedList: any[];
  formatNaira: (num: number) => string;
  onConfirmCategory: (expenseId: number, category: string) => void;
}

export function UnconfirmedAlertsBanner({
  unconfirmedList,
  formatNaira,
  onConfirmCategory,
}: UnconfirmedAlertsBannerProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  if (unconfirmedList.length === 0) return null;

  return (
    <View
      style={[
        styles.unconfirmedBanner,
        {
          backgroundColor: colors.warningBg,
          borderColor: colors.warning,
        },
      ]}
    >
      <View style={styles.unconfirmedHeader}>
        <Ionicons name="alert-circle" size={18} color={colors.warning} style={{ marginRight: 6 }} />
        <Text style={[styles.unconfirmedTitle, { color: colors.warning, fontSize: scaleFont(13) }]}>
          {unconfirmedList.length} Unconfirmed Bank Alert{unconfirmedList.length > 1 ? 's' : ''}
        </Text>
      </View>
      <Text style={[styles.unconfirmedSubtitle, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
        Tap a category to assign and synchronize with your budget:
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
        {unconfirmedList.map((item) => (
          <View
            key={item.id}
            style={[
              styles.unconfirmedCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.unconfirmedAmount, { color: colors.primary, fontSize: scaleFont(14) }]}>
              {formatNaira(item.amount)}
            </Text>
            <Text style={[styles.unconfirmedDesc, { color: colors.textSecondary, fontSize: scaleFont(11) }]} numberOfLines={1}>
              {item.description || 'Bank Debit Alert'}
            </Text>
            <View style={styles.catQuickChipsRow}>
              {['Food & Dining', 'Transport / Fuel', 'Airtime & Data', 'Utilities & Bills'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catQuickChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => {
                    triggerHaptic('selection');
                    onConfirmCategory(item.id, c);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.catQuickChipText, { color: colors.primary, fontSize: scaleFont(9) }]}>
                    {c.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  unconfirmedBanner: {
    borderWidth: 1,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
  },
  unconfirmedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unconfirmedTitle: {
    fontWeight: '700',
  },
  unconfirmedSubtitle: {
    marginTop: 2,
  },
  unconfirmedCard: {
    borderRadius: 12,
    padding: 10,
    marginRight: 8,
    borderWidth: 1,
    width: 200,
  },
  unconfirmedAmount: {
    fontWeight: '800',
  },
  unconfirmedDesc: {
    marginBottom: 6,
  },
  catQuickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  catQuickChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  catQuickChipText: {
    fontWeight: '700',
  },
});
