const db = require('./lib/db');

async function migrate() {
    try {
        console.log('Starting migration v2...');

        const tables = ['monthly_budgets', 'expenses', 'loans'];
        for (const table of tables) {
            try {
                await db.query(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
            } catch (e) {
                console.log(`ℹ️ 'user_id' in ${table}: ${e.message}`);
            }
        }
        try {
            await db.query('ALTER TABLE monthly_budgets DROP CONSTRAINT IF EXISTS monthly_budgets_month_year_key');
        } catch (e) {
            console.log('ℹ️ Failed to drop old constraint:', e.message);
        }

        try {
            await db.query('ALTER TABLE monthly_budgets ADD CONSTRAINT unique_user_month UNIQUE(user_id, month_year)');
            console.log('✅ Added composite unique constraint (user_id, month_year)');
        } catch (e) {
            console.log('ℹ️ Composite constraint status:', e.message);
        }
        const firstUser = await db.query('SELECT id FROM users LIMIT 1');
        if (firstUser.rows.length > 0) {
            const adminId = firstUser.rows[0].id;
            await db.query('UPDATE monthly_budgets SET user_id = $1 WHERE user_id IS NULL', [adminId]);
            await db.query('UPDATE expenses SET user_id = $1 WHERE user_id IS NULL', [adminId]);
            await db.query('UPDATE loans SET user_id = $1 WHERE user_id IS NULL', [adminId]);
            console.log(`✅ Assigned orphan records to user ID ${adminId}`);
        }

        console.log('Migration v2 finished successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
