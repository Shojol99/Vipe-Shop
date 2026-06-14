import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const db = new Database('vibeshop.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image TEXT,
    category TEXT
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    referrer_id TEXT,
    referred_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT,
    streak_count INTEGER DEFAULT 0,
    last_visit DATETIME,
    referral_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT,
    awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory (
    product_id TEXT PRIMARY KEY,
    stock INTEGER DEFAULT 100,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );
`);

// Seed Products if empty
const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
if (productCount.count === 0) {
  const insert = db.prepare('INSERT INTO products (id, name, description, price, image, category) VALUES (?, ?, ?, ?, ?, ?)');
  const products = [
    ['1', 'Neon Pulse Sneakers', 'High-performance sneakers with reactive LED soles.', 120, 'https://picsum.photos/seed/shoes/400/400', 'Footwear'],
    ['2', 'Cyberpunk Hoodie', 'Tech-wear hoodie with integrated heating elements.', 85, 'https://picsum.photos/seed/hoodie/400/400', 'Apparel'],
    ['3', 'Quantum Watch', 'A timepiece that syncs with your digital life.', 250, 'https://picsum.photos/seed/watch/400/400', 'Accessories'],
    ['4', 'Aero-Grip Backpack', 'Lightweight backpack with anti-gravity straps.', 110, 'https://picsum.photos/seed/bag/400/400', 'Gear'],
    ['5', 'Prism Shades', 'Smart glasses with augmented reality overlays.', 199, 'https://picsum.photos/seed/glasses/400/400', 'Accessories'],
    ['6', 'Stealth Jacket', 'Waterproof jacket with hidden storage compartments.', 145, 'https://picsum.photos/seed/jacket/400/400', 'Apparel'],
  ];
  products.forEach(p => {
    insert.run(...p);
    db.prepare('INSERT OR IGNORE INTO inventory (product_id, stock) VALUES (?, ?)').run(p[0], 100);
  });
}

async function startServer() {
  const app = express();
  const server = createHttpServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // Real-time visitor tracking
  let activeVisitors = new Set<WebSocket>();
  
  wss.on('connection', (ws) => {
    activeVisitors.add(ws);
    broadcastVisitorCount();

    ws.on('close', () => {
      activeVisitors.delete(ws);
      broadcastVisitorCount();
    });
  });

  function broadcastVisitorCount() {
    const count = activeVisitors.size;
    const data = JSON.stringify({ type: 'VISITOR_COUNT', count });
    activeVisitors.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // API Routes
  app.get('/api/products', (req, res) => {
    const products = db.prepare(`
      SELECT p.*, i.stock 
      FROM products p 
      JOIN inventory i ON p.id = i.product_id
    `).all();
    res.json(products);
  });

  app.get('/api/leaderboard', (req, res) => {
    const leaderboard = db.prepare('SELECT username, referral_count FROM users ORDER BY referral_count DESC LIMIT 5').all();
    res.json(leaderboard);
  });

  app.post('/api/user/sync', (req, res) => {
    const { userId, username } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      db.prepare('INSERT INTO users (id, username, last_visit) VALUES (?, ?, CURRENT_TIMESTAMP)').run(userId, username);
    } else {
      // Update streak logic
      const lastVisit = new Date(user.last_visit);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 3600 * 24));
      
      if (diffDays === 1) {
        db.prepare('UPDATE users SET streak_count = streak_count + 1, last_visit = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
      } else if (diffDays > 1) {
        db.prepare('UPDATE users SET streak_count = 1, last_visit = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
      } else {
        db.prepare('UPDATE users SET last_visit = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
      }
    }
    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const badges = db.prepare('SELECT * FROM badges WHERE user_id = ?').all();
    res.json({ ...updatedUser, badges });
  });

  app.post('/api/referral', (req, res) => {
    const { referrerId, referredId } = req.body;
    const id = uuidv4();
    db.prepare('INSERT INTO referrals (id, referrer_id, referred_id) VALUES (?, ?, ?)').run(id, referrerId, referredId);
    db.prepare('UPDATE users SET referral_count = referral_count + 1 WHERE id = ?').run(referrerId);
    
    // Award badge if referral count reaches threshold
    const user = db.prepare('SELECT referral_count FROM users WHERE id = ?').get(referrerId) as any;
    if (user.referral_count === 5) {
      db.prepare('INSERT INTO badges (id, user_id, type) VALUES (?, ?, ?)').run(uuidv4(), referrerId, 'Influencer');
    }

    res.json({ success: true });
  });

  app.post('/api/purchase', (req, res) => {
    const { userId, items, totalAmount, discountApplied } = req.body;
    const purchaseId = uuidv4();
    
    const transaction = db.transaction(() => {
      db.prepare('INSERT INTO purchases (id, user_id, total_amount, discount_applied) VALUES (?, ?, ?, ?)').run(
        purchaseId, userId, totalAmount, discountApplied
      );
      
      for (const item of items) {
        db.prepare('UPDATE inventory SET stock = stock - ? WHERE product_id = ?').run(item.quantity, item.id);
      }
    });
    
    transaction();
    res.json({ success: true, purchaseId });
  });

  app.get('/api/admin/inventory', (req, res) => {
    const inventory = db.prepare(`
      SELECT p.name, i.stock, p.id 
      FROM products p 
      JOIN inventory i ON p.id = i.product_id
    `).all();
    res.json(inventory);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function createHttpServer(app: express.Express) {
  return createServer(app);
}

startServer();
