const db = require('./lib/db');

async function migrate() {
    try {
        await db.query(`
            ALTER TABLE expenses 
            ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Otros'
        `);
        console.log('Migration successful: category column added to expenses table.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
