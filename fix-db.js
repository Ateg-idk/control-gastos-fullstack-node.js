const db = require('./lib/db');

async function check() {
    try {
        console.log('Checking budget_periods...');
        const resBP = await db.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'budget_periods')");
        console.log('budget_periods exists:', resBP.rows[0].exists);

        if (!resBP.rows[0].exists) {
            console.log('Attempting to create budget_periods manually...');
            await db.query(`CREATE TABLE budget_periods (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW
            )`);
            console.log('budget_periods created!');
        }

        console.log('Checking expenses columns...');
        const resExp = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'expenses'");
        console.log('Expenses columns:', resExp.rows.map(r => r.column_name).join(', '));

        if (!resExp.rows.map(r => r.column_name).includes('category')) {
            console.log('Adding category column to expenses...');
            await db.query("ALTER TABLE expenses ADD COLUMN category TEXT DEFAULT 'Otros'");
            console.log('Category column added!');
        }

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        process.exit();
    }
}

check();
