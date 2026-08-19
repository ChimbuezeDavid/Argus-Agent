import React from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSheet } from '@/components/shared/ModalSheet';
import { ActionButton } from '@/components/shared/ActionButton';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useHCITheme } from '@/hooks/useHCITheme';

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (amount: string, category: string, desc: string) => void;
  categories: string[];
  liveFormatHelper: (raw: string) => string | null;
  amountInput: string;
  setAmountInput: (val: string) => void;
  categoryInput: string;
  setCategoryInput: (val: string) => void;
  descInput: string;
  setDescInput: (val: string) => void;
}

export function AddExpenseModal({
  visible,
  onClose,
  onSave,
  categories,
  liveFormatHelper,
  amountInput,
  setAmountInput,
  categoryInput,
  setCategoryInput,
  descInput,
  setDescInput,
}: AddExpenseModalProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  return (
    <ModalSheet visible={visible} onClose={onClose} title="Log New Expense">
      <Text style={[styles.contextSubtitle, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
        Manually record an expense to update your live monthly budget, category limits, and transaction ledger.
      </Text>
      <Text style={[styles.inputLabel, { color: colors.textMuted, fontSize: scaleFont(11), marginTop: 10 }]}>AMOUNT TO LOG</Text>
      <View style={[styles.currencyInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.currencyPrefixBox, { backgroundColor: colors.primaryBg }]}>
          <Text style={[styles.currencyPrefixText, { color: colors.primary, fontSize: scaleFont(20) }]}>₦</Text>
        </View>
        <TextInput
          style={[styles.currencyTextInput, { color: colors.text, fontSize: scaleFont(18) }]}
          value={amountInput}
          onChangeText={setAmountInput}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          autoFocus
        />
      </View>
      {liveFormatHelper(amountInput) && (
        <Text style={[styles.liveHelperText, { color: colors.success, fontSize: scaleFont(11) }]}>
          Formatted: {liveFormatHelper(amountInput)}
        </Text>
      )}

      <Text style={[styles.inputLabel, { color: colors.textMuted, fontSize: scaleFont(11), marginTop: 12 }]}>CATEGORY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
          {categories.map((cat) => {
            const isSelected = categoryInput === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.modalCatChip,
                  {
                    backgroundColor: isSelected ? colors.primaryBg : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setCategoryInput(cat);
                }}
                activeOpacity={0.8}
              >
                <CategoryIcon category={cat} size={15} containerStyle={{ marginRight: 6 }} />
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
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Text style={[styles.inputLabel, { color: colors.textMuted, fontSize: scaleFont(11) }]}>DESCRIPTION / MERCHANT</Text>
      <TextInput
        style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontSize: scaleFont(14) }]}
        value={descInput}
        onChangeText={setDescInput}
        placeholder="e.g. Fuel at Total, Lunch with client"
        placeholderTextColor={colors.textMuted}
      />

      <View style={styles.modalBtnRow}>
        <ActionButton label="Cancel" variant="secondary" flex onPress={onClose} />
        <ActionButton
          label="Log Expense"
          variant="primary"
          flex
          disabled={!amountInput.trim() || !categoryInput.trim()}
          onPress={() => onSave(amountInput, categoryInput, descInput)}
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
  modalInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    marginBottom: 10,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
});
