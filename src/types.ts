export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stock?: number;
}

export interface User {
  id: string;
  username: string;
  streak_count: number;
  referral_count: number;
  badges: Badge[];
}

export interface Badge {
  id: string;
  type: string;
  awarded_at: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface DiscountTier {
  minVisitors: number;
  discount: number;
}

export const DISCOUNT_TIERS: DiscountTier[] = [
  { minVisitors: 0, discount: 10 },
  { minVisitors: 5, discount: 20 },
  { minVisitors: 10, discount: 30 },
  { minVisitors: 20, discount: 40 },
  { minVisitors: 50, discount: 50 },
];

export type AppTab = 'shop' | 'cart' | 'wishlist' | 'profile' | 'admin' | 'leaderboard';
