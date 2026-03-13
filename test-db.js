const db = require('./lib/db');

async function test() {
    try {
        console.log('--- DB TEST ---');
        const resBP = await db.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'budget_periods')");
        console.log('budget_periods exists today:', resBP.rows[0].exists);

        if (!resBP.rows[0].exists) {
            console.log('Creating budget_periods...');
            await db.query(`CREATE TABLE budget_periods (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            console.log('Table created.');
        } else {
            console.log('Table already exists. Listing columns:');
            const cols = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'budget_periods'");
            console.log(cols.rows.map(c => c.column_name).join(', '));
        }
        const verify = await db.query('SELECT * FROM budget_periods LIMIT 1');

    } catch (err) {
        console.error('FAIL:', err.message);
        console.error(err.stack);
    } finally {
        process.exit();
    }
}

test();
