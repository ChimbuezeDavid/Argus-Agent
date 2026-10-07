import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { SectionCard } from '@/components/shared';

interface CurrencySectionProps {
  settings: any;
}

interface CurrencyItem {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  sampleAmount: number;
}

const SUPPORTED_CURRENCIES: CurrencyItem[] = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG', sampleAmount: 250000 },
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', sampleAmount: 1500 },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', sampleAmount: 1200 },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', sampleAmount: 1400 },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA', sampleAmount: 2000 },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', locale: 'en-GH', sampleAmount: 18000 },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA', sampleAmount: 28000 },
];

export function CurrencySection({ settings }: CurrencySectionProps) {
  const { colors, scaleFont, triggerHaptic } = useHCITheme();
  const currentCode = settings.currency || 'NGN';
  const activeCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === currentCode) || SUPPORTED_CURRENCIES[0];

  const formatSample = (item: CurrencyItem) => {
    return `${item.symbol}${item.sampleAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <View style={styles.container}>
      {/* 1. Active Currency Hero Card */}
      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: '#10b981' }]}>
        <View style={styles.heroTopRow}>
          <View style={[styles.symbolPill, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Text style={[styles.heroSymbolText, { color: '#10b981', fontSize: scaleFont(24) }]}>
              {activeCurrency.symbol}
            </Text>
          </View>
          <View style={styles.heroMetaCol}>
            <Text style={[styles.heroCode, { color: colors.text, fontSize: scaleFont(16) }]}>
              {activeCurrency.name}
            </Text>
            <Text style={[styles.heroCodeBadge, { color: '#10b981', fontSize: scaleFont(12) }]}>
              Active Currency ({activeCurrency.code})
            </Text>
          </View>
        </View>

        <View style={[styles.sampleBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.sampleLabel, { color: colors.textMuted, fontSize: scaleFont(10) }]}>
            EXAMPLE LEDGER DISPLAY
          </Text>
          <Text style={[styles.sampleValue, { color: colors.primary, fontSize: scaleFont(18) }]}>
            {formatSample(activeCurrency)}
          </Text>
        </View>
      </View>

      {/* 2. Spacious Currency Selection Cards */}
      <SectionCard
        icon={<Ionicons name="cash-outline" size={scaleFont(20)} color="#10b981" style={{ marginRight: 8 }} />}
        title="Select Primary Currency"
        subtitle="Used for budget tracking, expense summaries, bank SMS parsing, and agent voice responses."
      >
        <View style={styles.currencyList}>
          {SUPPORTED_CURRENCIES.map((item) => {
            const isSelected = item.code === currentCode;
            return (
              <TouchableOpacity
                key={item.code}
                style={[
                  styles.currencyRowCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isSelected ? '#10b981' : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  settings.setCurrency(item.code);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.rowSymbolBox,
                    {
                      backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.15)' : colors.background,
                      borderColor: isSelected ? '#10b981' : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rowSymbolText,
                      { color: isSelected ? '#10b981' : colors.text, fontSize: scaleFont(15) },
                    ]}
                  >
                    {item.symbol}
                  </Text>
                </View>

                <View style={styles.currencyInfoCol}>
                  <View style={styles.codeRow}>
                    <Text style={[styles.currencyName, { color: colors.text, fontSize: scaleFont(13) }]}>
                      {item.name}
                    </Text>
                    <View style={[styles.codeTag, { backgroundColor: colors.background }]}>
                      <Text style={[styles.codeTagText, { color: colors.textSecondary, fontSize: scaleFont(10) }]}>
                        {item.code}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.currencyPreview, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
                    Preview: {formatSample(item)}
                  </Text>
                </View>

                <View style={styles.selectionIndicator}>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                  ) : (
                    <View style={[styles.radioEmpty, { borderColor: colors.border }]} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  symbolPill: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroSymbolText: {
    fontWeight: '900',
  },
  heroMetaCol: {
    flex: 1,
  },
  heroCode: {
    fontWeight: '800',
  },
  heroCodeBadge: {
    fontWeight: '700',
    marginTop: 2,
  },
  sampleBox: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  sampleLabel: {
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sampleValue: {
    fontWeight: '800',
  },
  currencyList: {
    gap: 10,
  },
  currencyRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
  },
  rowSymbolBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 12,
  },
  rowSymbolText: {
    fontWeight: '800',
  },
  currencyInfoCol: {
    flex: 1,
    marginRight: 10,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currencyName: {
    fontWeight: '700',
  },
  codeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codeTagText: {
    fontWeight: '700',
  },
  currencyPreview: {
    marginTop: 3,
  },
  selectionIndicator: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
});
