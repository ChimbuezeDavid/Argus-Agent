import React from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ModalSheet } from '@/components/shared/ModalSheet';
import { ActionButton } from '@/components/shared/ActionButton';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useHCITheme } from '@/hooks/useHCITheme';

interface SetBudgetModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (total: string, catLimit: string, category: string) => void;
  categories: string[];
  liveFormatHelper: (raw: string) => string | null;
  totalBudgetInput: string;
  setTotalBudgetInput: (val: string) => void;
  selectedBudgetCat: string;
  setSelectedBudgetCat: (val: string) => void;
  catBudgetInput: string;
  setCatBudgetInput: (val: string) => void;
  monthLabel?: string;
}

export function SetBudgetModal({
  visible,
  onClose,
  onSave,
  categories,
  liveFormatHelper,
  totalBudgetInput,
  setTotalBudgetInput,
  selectedBudgetCat,
  setSelectedBudgetCat,
  catBudgetInput,
  setCatBudgetInput,
  monthLabel,
}: SetBudgetModalProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  return (
    <ModalSheet visible={visible} onClose={onClose} title="Set Budget Limits">
      <Text style={[styles.contextSubtitle, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
        Establish total monthly spending caps and category limits to allow Argus to warn you before exceeding limits.
      </Text>
      <Text style={[styles.inputLabel, { color: colors.textMuted, fontSize: scaleFont(11), marginTop: 10 }]}>
        TOTAL MONTHLY LIMIT ({monthLabel || 'Current Month'})
      </Text>
      <View style={[styles.currencyInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.currencyPrefixBox, { backgroundColor: colors.primaryBg }]}>
          <Text style={[styles.currencyPrefixText, { color: colors.primary, fontSize: scaleFont(20) }]}>₦</Text>
        </View>
        <TextInput
          style={[styles.currencyTextInput, { color: colors.text, fontSize: scaleFont(18) }]}
          value={totalBudgetInput}
          onChangeText={setTotalBudgetInput}
          placeholder="250,000"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
      </View>
      {liveFormatHelper(totalBudgetInput) && (
        <Text style={[styles.liveHelperText, { color: colors.success, fontSize: scaleFont(11) }]}>
          Total Cap: {liveFormatHelper(totalBudgetInput)}
        </Text>
      )}

      <Text style={[styles.inputLabel, { color: colors.textMuted, fontSize: scaleFont(11), marginTop: 12 }]}>
        CATEGORY LIMIT TARGET
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
          {categories.map((c) => {
            const isSelected = selectedBudgetCat === c;
            return (
              <TouchableOpacity
                key={c}
                style={[
                  styles.modalCatChip,
                  {
                    backgroundColor: isSelected ? colors.primaryBg : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setSelectedBudgetCat(c);
                }}
                activeOpacity={0.7}
              >
                <CategoryIcon
                  category={c}
                  size={14}
                  containerStyle={{
                    width: 22,
                    height: 22,
                    marginRight: 6,
                  }}
                />
                <Text
                  style={[
                    styles.modalCatText,
                    {
                      color: isSelected ? colors.primary : colors.textSecondary,
                      fontSize: scaleFont(12),
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Text style={[styles.inputLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
        SPECIFIC LIMIT FOR {selectedBudgetCat.toUpperCase()}
      </Text>
      <View style={[styles.currencyInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.currencyPrefixBox, { backgroundColor: colors.primaryBg }]}>
          <Text style={[styles.currencyPrefixText, { color: colors.primary, fontSize: scaleFont(20) }]}>₦</Text>
        </View>
        <TextInput
          style={[styles.currencyTextInput, { color: colors.text, fontSize: scaleFont(18) }]}
          value={catBudgetInput}
          onChangeText={setCatBudgetInput}
          placeholder="e.g. 60,000"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
      </View>
      {liveFormatHelper(catBudgetInput) && (
        <Text style={[styles.liveHelperText, { color: colors.success, fontSize: scaleFont(11) }]}>
          {selectedBudgetCat} Limit: {liveFormatHelper(catBudgetInput)}
        </Text>
      )}

      <View style={styles.modalBtnRow}>
        <ActionButton label="Cancel" variant="secondary" flex onPress={onClose} />
        <ActionButton
          label="Save Limits"
          variant="primary"
          flex
          onPress={() => onSave(totalBudgetInput, catBudgetInput, selectedBudgetCat)}
        />
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  contextSubtitle: {
    lineHeight: 18,
    marginBottom: 8,
  },
  inputLabel: {
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  currencyInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    height: 52,
    overflow: 'hidden',
  },
  currencyPrefixBox: {
    width: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyPrefixText: {
    fontWeight: '800',
  },
  currencyTextInput: {
    flex: 1,
    paddingHorizontal: 14,
    fontWeight: '800',
    height: '100%',
  },
  liveHelperText: {
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 2,
  },
  modalCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalCatText: {},
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
});
