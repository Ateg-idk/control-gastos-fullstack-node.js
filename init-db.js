const db = require('./lib/db');
const bcrypt = require('bcryptjs');

async function initDb() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS monthly_budgets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(10, 2) NOT NULL,
      month_year TEXT NOT NULL,
      UNIQUE(user_id, month_year)
    )`,
    `CREATE TABLE IF NOT EXISTS budget_periods (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      date DATE DEFAULT CURRENT_DATE,
      category TEXT DEFAULT 'Otros',
      description TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS loans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      person_name TEXT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      status TEXT DEFAULT 'pending', -- 'pending' or 'paid'
      date DATE DEFAULT CURRENT_DATE,
      description TEXT
    )`
  ];

  try {
    for (let q of queries) {
      await db.query(q);
    }
    console.log('Database tables initialized or already exist.');

    const userRes = await db.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (userRes.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', ['admin', hashedPassword]);
      console.log('Default admin user created.');
    }
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

initDb().then(() => process.exit());
