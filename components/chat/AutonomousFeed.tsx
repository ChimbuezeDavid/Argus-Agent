import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Themed';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useHCITheme } from '@/hooks/useHCITheme';

export interface FeedItem {
  id: string;
  type: 'expense' | 'geofence' | 'storage' | 'rule' | 'expense_parsed' | 'geofence_arrival' | 'storage_intelligence';
  title: string;
  subtitle: string;
  tag?: string;
  badgeText?: string;
  badgeColor?: string;
  badgeType?: 'text' | 'button';
  iconType?: 'card' | 'location' | 'document';
  actionLabel?: string;
  timestamp?: string;
  onPress?: () => void;
}

interface AutonomousFeedProps {
  items?: FeedItem[];
  onOpenItem?: (item: FeedItem) => void;
}

export function AutonomousFeed({ items, onOpenItem }: AutonomousFeedProps) {
  const router = useRouter();
  const { colors, scaleFont, triggerHaptic } = useHCITheme();

  // Default rich feed items matching mockup if dynamic events are empty
  const defaultFeedItems: FeedItem[] = [
    {
      id: 'feed_1',
      type: 'expense',
      title: '₦3,500 Fuel Logged',
      subtitle: 'OPay SMS Parsed • Transport',
      badgeText: 'Auto',
      badgeColor: '#10b981',
      badgeType: 'text',
      iconType: 'card',
      onPress: () => router.push('/(tabs)/expenses'),
    },
    {
      id: 'feed_2',
      type: 'geofence',
      title: 'Arrived at Home',
      subtitle: 'Switched to Personal Mode • 4:45 PM',
      badgeText: 'Rule',
      badgeColor: colors.textMuted,
      badgeType: 'text',
      iconType: 'location',
      onPress: () => router.push('/(tabs)/vault'),
    },
    {
      id: 'feed_3',
      type: 'storage',
      title: 'Invoice_Aug2026.pdf',
      subtitle: 'Indexed in Downloads • 1.2 MB',
      badgeText: 'Open',
      badgeColor: colors.primary,
      badgeType: 'button',
      iconType: 'document',
      onPress: () => router.push('/(tabs)/vault'),
    },
  ];

  const displayItems = items && items.length > 0 ? items : defaultFeedItems;

  const renderIcon = (type?: string, iconType?: string) => {
    if (iconType === 'card' || type === 'expense' || type === 'expense_parsed') {
      return (
        <View style={[styles.iconBox, { backgroundColor: colors.primaryBg }]}>
          <MaterialCommunityIcons name="credit-card" size={18} color={colors.primary} />
        </View>
      );
    }
    if (iconType === 'location' || type === 'geofence' || type === 'geofence_arrival') {
      return (
        <View style={[styles.iconBox, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
          <Ionicons name="location" size={18} color="#f43f5e" />
        </View>
      );
    }
    return (
      <View style={[styles.iconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
        <Ionicons name="document-text" size={18} color="#a855f7" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.textMuted, fontSize: scaleFont(11) }]}>
        AUTONOMOUS FEED
      </Text>

      <View style={styles.feedStack}>
        {displayItems.map((item) => {
          const badgeText = item.badgeText || item.tag || (item.actionLabel ? item.actionLabel : undefined);
          const isButton = item.badgeType === 'button' || !!item.actionLabel;

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.feedCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                triggerHaptic('selection');
                if (item.onPress) {
                  item.onPress();
                } else if (onOpenItem) {
                  onOpenItem(item);
                } else if (item.type.includes('expense')) {
                  router.push('/(tabs)/expenses');
                } else {
                  router.push('/(tabs)/vault');
                }
              }}
              activeOpacity={0.8}
            >
              {renderIcon(item.type, item.iconType)}

              <View style={styles.infoCol}>
                <Text style={[styles.itemTitle, { color: colors.text, fontSize: scaleFont(14) }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.itemSubtitle, { color: colors.textSecondary, fontSize: scaleFont(12) }]} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>

              {badgeText && (
                isButton ? (
                  <View style={[styles.actionBtnBox, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
                    <Text style={[styles.actionBtnText, { color: colors.primary, fontSize: scaleFont(12) }]}>
                      {badgeText}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.tagBadgeText,
                      {
                        color: item.badgeColor || (item.tag === 'Auto' ? '#10b981' : colors.textMuted),
                        fontSize: scaleFont(12),
                      },
                    ]}
                  >
                    {badgeText}
                  </Text>
                )
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 18,
  },
  sectionHeader: {
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  feedStack: {
    gap: 10,
  },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  itemTitle: {
    fontWeight: '700',
    marginBottom: 3,
  },
  itemSubtitle: {},
  tagBadgeText: {
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  actionBtnBox: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  actionBtnText: {
    fontWeight: '700',
  },
});
