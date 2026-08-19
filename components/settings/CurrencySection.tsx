import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';
import { SectionCard, ChipSelector, ChipOption } from '@/components/shared';

interface CurrencySectionProps {
  settings: any;
}

const CURRENCIES = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
];

export function CurrencySection({ settings }: CurrencySectionProps) {
  const { scaleFont, triggerHaptic } = useHCITheme();

  const options: ChipOption[] = CURRENCIES.map(c => ({
    id: c.code,
    label: c.symbol,
    description: c.code,
  }));

  return (
    <SectionCard
      icon={<Ionicons name="cash-outline" size={scaleFont(20)} color="#10b981" style={{ marginRight: 8 }} />}
      title="Localization & Currency"
      subtitle="Default currency formatting and financial statement parsing."
    >
      <ChipSelector
        options={options}
        selectedId={settings.currency}
        onSelect={(id) => {
          triggerHaptic('selection');
          settings.setCurrency(id);
        }}
        equalWidth
      />
    </SectionCard>
  );
}
