const db = require('./lib/db');
const fs = require('fs');

async function test() {
    let output = '';
    const log = (msg) => { output += msg + '\n'; console.log(msg); };

    try {
        log('--- DB DIAGNOSTICS ---');
        log('Time: ' + new Date().toISOString());
        const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        log('Tables found: ' + tables.rows.map(r => r.table_name).join(', '));

        if (!tables.rows.map(r => r.table_name).includes('budget_periods')) {
            log('CRITICAL: budget_periods NOT FOUND. Creating now...');
            await db.query(`
                CREATE TABLE budget_periods (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    amount DECIMAL(10, 2) NOT NULL,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            log('Creation successful.');
        } else {
            log('budget_periods exists.');
            const cols = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'budget_periods'");
            log('Columns: ' + cols.rows.map(c => c.column_name).join(', '));
        }
        const tablesFinal = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        log('Final Tables: ' + tablesFinal.rows.map(r => r.table_name).join(', '));

    } catch (err) {
        log('ERROR ERROR ERROR');
        log(err.message);
        log(err.stack);
    } finally {
        fs.writeFileSync('db_final_log.txt', output);
        process.exit();
    }
}

test();
