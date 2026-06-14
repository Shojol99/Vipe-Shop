import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, 
  Users, 
  Share2, 
  Clock, 
  TrendingUp, 
  ShoppingBag,
  Heart,
  ChevronRight,
  Zap,
  Award,
  Menu,
  X,
  User as UserIcon,
  Trophy,
  Settings,
  Flame,
  LayoutDashboard,
  Package
} from 'lucide-react';
import { format, addWeeks, nextMonday, setHours, setMinutes, setSeconds, differenceInSeconds } from 'date-fns';
import { Product, CartItem, DISCOUNT_TIERS, User, Badge, AppTab } from './types';
import { cn } from './lib/utils';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [visitorCount, setVisitorCount] = useState(1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>('shop');
  const [user, setUser] = useState<User | null>(null);
  const [leaderboard, setLeaderboard] = useState<{username: string, referral_count: number}[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<{id: string, message: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const addNotification = (message: string) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const toggleWishlist = (product: Product) => {
    setWishlist(prev => {
      const exists = prev.find(p => p.id === product.id);
      if (exists) return prev.filter(p => p.id !== product.id);
      return [...prev, product];
    });
  };

  const isInWishlist = (id: string) => wishlist.some(p => p.id === id);
  const [referralCode] = useState(() => Math.random().toString(36).substring(7));

  // Calculate next purchase window (Every Monday at 12 PM)
  const nextWindow = useMemo(() => {
    const now = new Date();
    let target = nextMonday(now);
    target = setHours(target, 12);
    target = setMinutes(target, 0);
    target = setSeconds(target, 0);
    return target;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diff = differenceInSeconds(nextWindow, now);
      setTimeLeft(diff > 0 ? diff : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [nextWindow]);

  const formatTime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  };

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(setProducts);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'VISITOR_COUNT') {
        const prevCount = visitorCount;
        setVisitorCount(data.count);
        
        // Notify on discount tier unlock
        const newTier = [...DISCOUNT_TIERS].reverse().find(t => data.count >= t.minVisitors);
        const oldTier = [...DISCOUNT_TIERS].reverse().find(t => prevCount >= t.minVisitors);
        if (newTier && oldTier && newTier.discount > oldTier.discount) {
          addNotification(`🎉 NEW DISCOUNT UNLOCKED: ${newTier.discount}% OFF!`);
        }
      }
    };

    // Simulated User Sync
    const userId = localStorage.getItem('vibeshop_user_id') || Math.random().toString(36).substring(7);
    localStorage.setItem('vibeshop_user_id', userId);
    
    fetch('/api/user/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, username: `Viber_${userId.substring(0, 4)}` })
    })
      .then(res => res.json())
      .then(setUser);

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetch('/api/leaderboard').then(res => res.json()).then(setLeaderboard);
    }
    if (activeTab === 'admin') {
      fetch('/api/admin/stats').then(res => res.json()).then(setAdminStats);
      fetch('/api/admin/inventory').then(res => res.json()).then(setInventory);
    }
  }, [activeTab]);

  const currentTier = useMemo(() => {
    return [...DISCOUNT_TIERS].reverse().find(t => visitorCount >= t.minVisitors) || DISCOUNT_TIERS[0];
  }, [visitorCount]);

  const nextTier = useMemo(() => {
    return DISCOUNT_TIERS.find(t => t.minVisitors > visitorCount);
  }, [visitorCount]);

  const progress = useMemo(() => {
    if (!nextTier) return 100;
    const prevMin = DISCOUNT_TIERS.find(t => t.discount === currentTier.discount)?.minVisitors || 0;
    return ((visitorCount - prevMin) / (nextTier.minVisitors - prevMin)) * 100;
  }, [visitorCount, currentTier, nextTier]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountedTotal = cartTotal * (1 - currentTier.discount / 100);

  const handleShare = () => {
    const url = `${window.location.origin}?ref=${referralCode}`;
    navigator.clipboard.writeText(url);
    addNotification('🔗 Referral link copied to clipboard!');
  };

  const handleCheckout = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          items: cart,
          totalAmount: discountedTotal,
          discountApplied: currentTier.discount
        })
      });
      if (res.ok) {
        addNotification('🚀 PURCHASE SUCCESSFUL! Your gear is on the way.');
        setCart([]);
        setActiveTab('profile');
      }
    } catch (error) {
      addNotification('❌ Checkout failed. Please try again.');
    }
  };

  const isCheckoutOpen = timeLeft === 0;

  return (
    <>
      {/* Notifications */}
      <div className="fixed top-20 right-6 z-[100] space-y-4 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#141414] text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 pointer-events-auto"
            >
              <Zap size={18} className="text-[#F27D26]" />
              <span className="text-sm font-bold uppercase tracking-widest">{n.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed inset-0 bg-white z-[90] pt-24 px-6"
          >
            <div className="flex flex-col gap-8 text-2xl font-bold uppercase tracking-tighter">
              <button onClick={() => { setActiveTab('shop'); setIsMenuOpen(false); }}>Shop</button>
              <button onClick={() => { setActiveTab('wishlist'); setIsMenuOpen(false); }}>Wishlist</button>
              <button onClick={() => { setActiveTab('leaderboard'); setIsMenuOpen(false); }}>Leaderboard</button>
              <button onClick={() => { setActiveTab('profile'); setIsMenuOpen(false); }}>Profile</button>
              <button onClick={() => { setActiveTab('admin'); setIsMenuOpen(false); }}>Admin</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Top Banner - Countdown */}
      <div className="bg-[#141414] text-white py-2 px-4 text-center text-xs font-mono tracking-widest uppercase overflow-hidden relative">
        <motion.div 
          animate={{ x: [0, -100, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="whitespace-nowrap"
        >
          Next Purchase Window Opens In: {formatTime(timeLeft)} • Free Shipping on orders over $150 • {currentTier.discount}% OFF ACTIVE
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#141414]/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#141414] rounded-full flex items-center justify-center text-white">
              <ShoppingBag size={20} />
            </div>
            <span className="text-xl font-bold tracking-tighter uppercase italic">VibeShop</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium uppercase tracking-wider">
            <button onClick={() => setActiveTab('shop')} className={cn("hover:opacity-50 transition-opacity", activeTab === 'shop' && "underline underline-offset-8")}>Shop</button>
            <button onClick={() => setActiveTab('wishlist')} className={cn("hover:opacity-50 transition-opacity", activeTab === 'wishlist' && "underline underline-offset-8")}>Wishlist</button>
            <button onClick={() => setActiveTab('leaderboard')} className={cn("hover:opacity-50 transition-opacity", activeTab === 'leaderboard' && "underline underline-offset-8")}>Leaderboard</button>
            <button onClick={() => setActiveTab('admin')} className={cn("hover:opacity-50 transition-opacity", activeTab === 'admin' && "underline underline-offset-8")}>Admin</button>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-[#141414]/5 px-3 py-1.5 rounded-full">
              <Users size={16} className="text-[#141414]/60" />
              <span className="text-xs font-mono font-bold">{visitorCount} LIVE</span>
            </div>
            <button 
              onClick={() => setActiveTab('profile')}
              className="relative p-2 hover:bg-[#141414]/5 rounded-full transition-colors"
            >
              <UserIcon size={20} />
              {user?.streak_count && user.streak_count > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center gap-0.5 bg-[#F27D26] text-white text-[8px] px-1 rounded-full font-bold">
                  <Flame size={8} /> {user.streak_count}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('cart')}
              className="relative p-2 hover:bg-[#141414]/5 rounded-full transition-colors"
            >
              <ShoppingCart size={20} />
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-[#F27D26] text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                  {cart.length}
                </span>
              )}
            </button>
            <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'shop' && (
          <>
            {/* Hero Section */}
            <section className="mb-20 grid md:grid-cols-2 gap-12 items-center">
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-[#F27D26]/10 text-[#F27D26] rounded-full text-xs font-bold uppercase tracking-widest mb-6"
                >
                  <Zap size={14} />
                  Dynamic Discount Active
                </motion.div>
                <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-[0.9] mb-8 uppercase">
                  The More <br />
                  <span className="italic serif text-[#F27D26]">The Merrier.</span>
                </h1>
                <p className="text-lg text-[#141414]/60 max-w-md mb-10">
                  Our prices drop as more people join. Invite your friends to unlock up to 50% OFF. Next purchase window opens every Monday.
                </p>
                
                <div className="space-y-6">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-mono uppercase tracking-wider opacity-60">Current Discount</span>
                    <span className="text-4xl font-bold">{currentTier.discount}% OFF</span>
                  </div>
                  <div className="h-4 bg-[#141414]/5 rounded-full overflow-hidden border border-[#141414]/10">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-[#141414]"
                    />
                  </div>
                  {nextTier && (
                    <p className="text-xs font-mono uppercase tracking-widest opacity-60 text-center">
                      {nextTier.minVisitors - visitorCount} more visitors needed for {nextTier.discount}% OFF
                    </p>
                  )}
                  
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={handleShare}
                      className="flex-1 bg-[#141414] text-white py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#141414]/90 transition-colors"
                    >
                      <Share2 size={18} />
                      Invite Friends
                    </button>
                    <button className="w-16 h-16 border-2 border-[#141414] rounded-xl flex items-center justify-center hover:bg-[#141414] hover:text-white transition-all">
                      <TrendingUp size={24} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="aspect-[4/5] bg-[#141414]/5 rounded-3xl overflow-hidden border border-[#141414]/10 relative group">
                  <img 
                    src="https://picsum.photos/seed/vibeshop-hero/800/1000" 
                    alt="Featured Product"
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141414]/80 to-transparent flex flex-col justify-end p-8 text-white">
                    <span className="text-xs font-mono uppercase tracking-widest mb-2 opacity-60">Featured Drop</span>
                    <h3 className="text-3xl font-bold uppercase tracking-tighter mb-4">Aero-Grip Collection</h3>
                    <button className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest group">
                      Explore Collection <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
                {/* Floating Badge */}
                <motion.div 
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="absolute -top-6 -right-6 w-32 h-32 bg-[#F27D26] rounded-full flex flex-col items-center justify-center text-white text-center p-4 shadow-2xl border-4 border-white"
                >
                  <Award size={32} className="mb-1" />
                  <span className="text-[10px] font-bold uppercase leading-tight">Top Rated Gear</span>
                </motion.div>
              </div>
            </section>
          </>
        )}

        {/* Product Grid / Wishlist / Admin / Profile / Leaderboard */}
        <section className="mb-20">
          {activeTab === 'admin' ? (
            <div className="space-y-12">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-bold uppercase tracking-tighter">Admin Dashboard</h2>
                  <p className="text-[#141414]/60">Platform overview and inventory management.</p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-[#141414]/5 shadow-sm">
                    <p className="text-[10px] font-mono uppercase opacity-40 mb-1">Total Sales</p>
                    <p className="text-xl font-bold">${adminStats?.totalSales?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-[#141414]/5 shadow-sm">
                    <p className="text-[10px] font-mono uppercase opacity-40 mb-1">Total Users</p>
                    <p className="text-xl font-bold">{adminStats?.totalUsers || 0}</p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-[#141414]/5 shadow-sm">
                  <h3 className="text-xl font-bold uppercase mb-6 flex items-center gap-2">
                    <Package size={20} /> Inventory Status
                  </h3>
                  <div className="space-y-4">
                    {inventory.map(item => (
                      <div key={item.id} className="flex justify-between items-center py-3 border-b border-[#141414]/5 last:border-0">
                        <span className="text-sm font-medium">{item.name}</span>
                        <div className="flex items-center gap-4">
                          <div className="h-2 w-24 bg-[#141414]/5 rounded-full overflow-hidden">
                            <div className="h-full bg-[#F27D26]" style={{ width: `${item.stock}%` }} />
                          </div>
                          <span className="text-xs font-mono font-bold">{item.stock} UNITS</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-[#141414]/5 shadow-sm">
                  <h3 className="text-xl font-bold uppercase mb-6 flex items-center gap-2">
                    <LayoutDashboard size={20} /> Quick Actions
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button className="p-4 border border-[#141414]/10 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-white transition-all">Add Product</button>
                    <button className="p-4 border border-[#141414]/10 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-white transition-all">Export Data</button>
                    <button className="p-4 border border-[#141414]/10 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-white transition-all">Set Tiers</button>
                    <button className="p-4 border border-[#141414]/10 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-white transition-all">View Logs</button>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'profile' ? (
            <div className="max-w-2xl mx-auto space-y-12">
              <div className="text-center">
                <div className="w-24 h-24 bg-[#141414] rounded-full mx-auto mb-6 flex items-center justify-center text-white">
                  <UserIcon size={40} />
                </div>
                <h2 className="text-4xl font-bold uppercase tracking-tighter">{user?.username}</h2>
                <p className="text-[#141414]/60">Member since Feb 2026</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-[#141414]/5 shadow-sm text-center">
                  <Flame size={32} className="mx-auto mb-2 text-[#F27D26]" />
                  <p className="text-2xl font-bold">{user?.streak_count} DAYS</p>
                  <p className="text-[10px] font-mono uppercase opacity-40">Visit Streak</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-[#141414]/5 shadow-sm text-center">
                  <Share2 size={32} className="mx-auto mb-2 text-[#F27D26]" />
                  <p className="text-2xl font-bold">{user?.referral_count}</p>
                  <p className="text-[10px] font-mono uppercase opacity-40">Total Referrals</p>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold uppercase mb-6 flex items-center gap-2">
                  <Award size={20} /> Your Badges
                </h3>
                <div className="flex gap-4">
                  {user?.badges.length === 0 ? (
                    <p className="text-sm opacity-40 italic">No badges earned yet. Keep sharing!</p>
                  ) : (
                    user?.badges.map(badge => (
                      <div key={badge.id} className="bg-[#F27D26] text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <Award size={14} /> {badge.type}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'leaderboard' ? (
            <div className="max-w-2xl mx-auto space-y-12">
              <div className="text-center">
                <Trophy size={48} className="mx-auto mb-4 text-[#F27D26]" />
                <h2 className="text-4xl font-bold uppercase tracking-tighter">Referral Hall of Fame</h2>
                <p className="text-[#141414]/60">The top influencers driving the community discount.</p>
              </div>

              <div className="bg-white rounded-3xl border border-[#141414]/5 shadow-sm overflow-hidden">
                {leaderboard.map((entry, index) => (
                  <div key={entry.username} className="flex justify-between items-center p-6 border-b border-[#141414]/5 last:border-0">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold opacity-20 w-8">0{index + 1}</span>
                      <span className="font-bold uppercase tracking-tight">{entry.username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">{entry.referral_count}</span>
                      <span className="text-[10px] font-mono uppercase opacity-40">Referrals</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h2 className="text-4xl font-bold uppercase tracking-tighter">
                    {activeTab === 'wishlist' ? 'Your Wishlist' : 'The Catalog'}
                  </h2>
                  <p className="text-[#141414]/60">
                    {activeTab === 'wishlist' ? 'Items you have saved for later.' : 'Curated essentials for the modern nomad.'}
                  </p>
                </div>
                {activeTab === 'shop' && (
                  <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    {['All', 'Apparel', 'Accessories', 'Gear'].map(cat => (
                      <button 
                        key={cat} 
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "px-4 py-2 text-xs font-bold uppercase tracking-widest border border-[#141414]/10 rounded-full transition-all whitespace-nowrap",
                          selectedCategory === cat ? "bg-[#141414] text-white" : "hover:bg-[#141414] hover:text-white"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {activeTab === 'shop' && (
                <div className="mb-8">
                  <input 
                    type="text" 
                    placeholder="Search products..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-[#141414]/10 rounded-xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#F27D26]/20 transition-all"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {activeTab === 'wishlist' && wishlist.length === 0 ? (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-[#141414]/10 rounded-3xl">
                    <Heart size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="uppercase tracking-widest font-bold opacity-40">Your wishlist is empty</p>
                    <button 
                      onClick={() => setActiveTab('shop')}
                      className="mt-4 text-[#F27D26] font-bold uppercase tracking-widest text-xs hover:underline"
                    >
                      Back to Shop
                    </button>
                  </div>
                ) : (activeTab === 'wishlist' ? wishlist : filteredProducts).map((product) => (
                  <motion.div 
                    key={product.id}
                    layout
                    whileHover={{ y: -8 }}
                    onClick={() => setSelectedProduct(product)}
                    className="group bg-white rounded-2xl overflow-hidden border border-[#141414]/5 shadow-sm hover:shadow-xl transition-all cursor-pointer"
                  >
                    <div className="aspect-square relative overflow-hidden bg-[#F5F5F0]">
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        onClick={() => toggleWishlist(product)}
                        className={cn(
                          "absolute top-4 right-4 p-2 backdrop-blur-md rounded-full transition-colors",
                          isInWishlist(product.id) ? "bg-[#F27D26] text-white" : "bg-white/80 text-[#141414] hover:bg-[#141414] hover:text-white"
                        )}
                      >
                        <Heart size={18} className={cn(isInWishlist(product.id) && "fill-current")} />
                      </button>
                      <div className="absolute bottom-4 left-4 right-4 translate-y-12 group-hover:translate-y-0 transition-transform">
                        <button 
                          onClick={() => addToCart(product)}
                          className="w-full bg-[#141414] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">{product.category}</span>
                        <span className="text-lg font-bold">${product.price}</span>
                      </div>
                      <h3 className="text-xl font-bold uppercase tracking-tight mb-2">{product.name}</h3>
                      <p className="text-sm text-[#141414]/60 line-clamp-2">{product.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Gamification Stats */}
        <section className="bg-[#141414] text-white rounded-3xl p-12 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="100" cy="0" r="80" fill="none" stroke="currentColor" strokeWidth="0.5" />
              <circle cx="100" cy="0" r="60" fill="none" stroke="currentColor" strokeWidth="0.5" />
              <circle cx="100" cy="0" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </svg>
          </div>
          
          <div className="relative z-10 grid md:grid-cols-3 gap-12">
            <div>
              <div className="w-12 h-12 bg-[#F27D26] rounded-xl flex items-center justify-center mb-6">
                <TrendingUp size={24} />
              </div>
              <h3 className="text-2xl font-bold uppercase mb-4">Community Driven</h3>
              <p className="text-white/60 text-sm">Every visitor contributes to the global discount. Watch the counter rise and prices fall in real-time.</p>
            </div>
            <div>
              <div className="w-12 h-12 bg-[#F27D26] rounded-xl flex items-center justify-center mb-6">
                <Clock size={24} />
              </div>
              <h3 className="text-2xl font-bold uppercase mb-4">Weekly Drops</h3>
              <p className="text-white/60 text-sm">We open the gates once a week. Fill your cart now and be ready when the timer hits zero.</p>
            </div>
            <div>
              <div className="w-12 h-12 bg-[#F27D26] rounded-xl flex items-center justify-center mb-6">
                <Award size={24} />
              </div>
              <h3 className="text-2xl font-bold uppercase mb-4">Referral Perks</h3>
              <p className="text-white/60 text-sm">Top referrers get early access and exclusive badges. Your influence is your currency here.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-[#141414]/60 backdrop-blur-md z-[110]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-white z-[120] rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
            >
              <div className="md:w-1/2 aspect-square bg-[#F5F5F0]">
                <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="md:w-1/2 p-12 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest opacity-40 mb-2 block">{selectedProduct.category}</span>
                    <h2 className="text-4xl font-bold uppercase tracking-tighter">{selectedProduct.name}</h2>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-[#141414]/5 rounded-full">
                    <X size={24} />
                  </button>
                </div>
                <p className="text-lg text-[#141414]/60 mb-8 flex-1">{selectedProduct.description}</p>
                
                <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-mono uppercase opacity-40">Price</span>
                    <div className="text-right">
                      <p className="text-sm line-through opacity-40">${selectedProduct.price}</p>
                      <p className="text-3xl font-bold text-[#F27D26]">${(selectedProduct.price * (1 - currentTier.discount / 100)).toFixed(2)}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <button 
                      onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                      className="flex-1 bg-[#141414] text-white py-5 rounded-xl font-bold uppercase tracking-widest hover:bg-[#141414]/90 transition-all"
                    >
                      Add to Cart
                    </button>
                    <button 
                      onClick={() => { toggleWishlist(selectedProduct); }}
                      className={cn(
                        "p-5 rounded-xl border-2 transition-all",
                        isInWishlist(selectedProduct.id) ? "bg-[#F27D26] border-[#F27D26] text-white" : "border-[#141414]/10 text-[#141414] hover:bg-[#141414] hover:text-white"
                      )}
                    >
                      <Heart size={24} className={cn(isInWishlist(selectedProduct.id) && "fill-current")} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeTab === 'cart' && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveTab('shop')}
              className="fixed inset-0 bg-[#141414]/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl p-8 flex flex-col"
            >
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-bold uppercase tracking-tighter">Your Cart</h2>
                <button onClick={() => setActiveTab('shop')} className="p-2 hover:bg-[#141414]/5 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {cart.length === 0 ? (
                  <div className="text-center py-20 opacity-40">
                    <ShoppingBag size={48} className="mx-auto mb-4" />
                    <p className="uppercase tracking-widest text-sm font-bold">Your cart is empty</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex gap-4 group">
                      <div className="w-24 h-24 bg-[#F5F5F0] rounded-xl overflow-hidden border border-[#141414]/5">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <h4 className="font-bold uppercase text-sm">{item.name}</h4>
                          <button onClick={() => removeFromCart(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500">
                            <X size={16} />
                          </button>
                        </div>
                        <p className="text-xs text-[#141414]/60 mb-2">Qty: {item.quantity}</p>
                        <p className="font-bold">${item.price}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="pt-8 border-t border-[#141414]/10 space-y-4">
                  <div className="flex justify-between text-sm opacity-60 uppercase tracking-widest">
                    <span>Subtotal</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#F27D26] font-bold uppercase tracking-widest">
                    <span>Dynamic Discount ({currentTier.discount}%)</span>
                    <span>-${(cartTotal - discountedTotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold uppercase tracking-tighter pt-2">
                    <span>Total</span>
                    <span>${discountedTotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="bg-[#F27D26]/10 p-4 rounded-xl flex items-start gap-3 mb-4">
                    <Clock size={18} className="text-[#F27D26] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#F27D26] font-medium">
                      {isCheckoutOpen 
                        ? "Checkout is OPEN! Complete your purchase now with the community discount."
                        : "Checkout is currently locked. Come back on Monday at 12:00 PM to complete your purchase with the final discount!"}
                    </p>
                  </div>

                  <button 
                    onClick={handleCheckout}
                    disabled={!isCheckoutOpen}
                    className={cn(
                      "w-full py-5 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                      isCheckoutOpen 
                        ? "bg-[#141414] text-white hover:bg-[#141414]/90" 
                        : "bg-[#141414] text-white opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isCheckoutOpen ? "Complete Purchase" : "Checkout Locked"}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-[#141414]/10 py-20 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-[#141414] rounded-full flex items-center justify-center text-white">
                <ShoppingBag size={16} />
              </div>
              <span className="text-lg font-bold tracking-tighter uppercase italic">VibeShop</span>
            </div>
            <p className="text-[#141414]/60 max-w-sm mb-8">
              The world's first community-powered e-commerce platform. We believe in the power of the collective.
            </p>
            <div className="flex gap-4">
              {['Twitter', 'Instagram', 'Discord'].map(social => (
                <button key={social} className="text-xs font-bold uppercase tracking-widest hover:underline">{social}</button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs mb-6">Support</h4>
            <ul className="space-y-4 text-sm text-[#141414]/60">
              <li><button className="hover:text-[#141414]">Shipping Policy</button></li>
              <li><button className="hover:text-[#141414]">Returns & Exchanges</button></li>
              <li><button className="hover:text-[#141414]">Contact Us</button></li>
              <li><button className="hover:text-[#141414]">FAQ</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold uppercase tracking-widest text-xs mb-6">Company</h4>
            <ul className="space-y-4 text-sm text-[#141414]/60">
              <li><button className="hover:text-[#141414]">About Us</button></li>
              <li><button className="hover:text-[#141414]">Sustainability</button></li>
              <li><button className="hover:text-[#141414]">Terms of Service</button></li>
              <li><button className="hover:text-[#141414]">Privacy Policy</button></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-[#141414]/5 flex justify-between items-center text-[10px] font-mono uppercase tracking-widest opacity-40">
          <span>© 2026 VibeShop Collective</span>
          <span>Built for the future of commerce</span>
        </div>
      </footer>
    </>
  );
}
