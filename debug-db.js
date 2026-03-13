const db = require('./lib/db');

async function debug() {
    try {
        console.log('Attempting to create budget_periods...');
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
        console.log('Success!');
    } catch (err) {
        console.log('ERROR_START');
        console.log(err.message);
        console.log(err.stack);
        console.log(JSON.stringify(err, null, 2));
        console.log('ERROR_END');
    } finally {
        process.exit();
    }
}

debug();
