import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Utensils,
  Car,
  Home,
  ShoppingCart,
  Coffee,
  Film,
  Tag,
  Receipt,
  ArrowRightLeft,
} from 'lucide-react-native';
import { radii } from '../../theme';

interface CategoryBadgeProps {
  categoryName?: string;
  expenseTitle?: string;
  size?: number;
  isSettlement?: boolean;
}

interface CategoryConfig {
  icon: React.ComponentType<{ size: number; color: string }>;
  bg: string;
  color: string;
}

function resolveCategory(title?: string, cat?: string, isSettlement?: boolean): CategoryConfig {
  if (isSettlement) {
    return { icon: ArrowRightLeft, bg: '#ECFDF5', color: '#059669' };
  }

  const query = `${title || ''} ${cat || ''}`.toLowerCase();

  if (query.includes('dinner') || query.includes('food') || query.includes('lunch') || query.includes('breakfast') || query.includes('restaurant') || query.includes('pizza') || query.includes('burger')) {
    return { icon: Utensils, bg: '#FEF3C7', color: '#D97706' }; // Amber
  }
  if (query.includes('uber') || query.includes('cab') || query.includes('taxi') || query.includes('fuel') || query.includes('petrol') || query.includes('flight') || query.includes('train') || query.includes('travel')) {
    return { icon: Car, bg: '#DBEAFE', color: '#2563EB' }; // Blue
  }
  if (query.includes('hotel') || query.includes('stay') || query.includes('airbnb') || query.includes('rent') || query.includes('room')) {
    return { icon: Home, bg: '#EDE9FE', color: '#7C3AED' }; // Purple
  }
  if (query.includes('grocery') || query.includes('supermarket') || query.includes('store') || query.includes('ration')) {
    return { icon: ShoppingCart, bg: '#DCFCE7', color: '#16A34A' }; // Green
  }
  if (query.includes('coffee') || query.includes('tea') || query.includes('bar') || query.includes('drinks') || query.includes('beer')) {
    return { icon: Coffee, bg: '#FCE7F3', color: '#DB2777' }; // Pink
  }
  if (query.includes('movie') || query.includes('cinema') || query.includes('game') || query.includes('ticket')) {
    return { icon: Film, bg: '#FEE2E2', color: '#DC2626' }; // Red
  }

  return { icon: Tag, bg: '#F1F5F9', color: '#64748B' }; // Slate default
}

export function CategoryBadge({
  categoryName,
  expenseTitle,
  size = 40,
  isSettlement = false,
}: CategoryBadgeProps) {
  const config = resolveCategory(expenseTitle, categoryName, isSettlement);
  const IconComponent = config.icon;
  const iconSize = Math.round(size * 0.48);

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: radii.md,
          backgroundColor: config.bg,
        },
      ]}
    >
      <IconComponent size={iconSize} color={config.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
