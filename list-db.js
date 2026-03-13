const db = require('./lib/db');

async function list() {
    try {
        console.log('Listing tables...');
        const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables:', res.rows.map(r => r.table_name).join(', '));
    } catch (err) {
        console.error('List failed:', err);
    } finally {
        process.exit();
    }
}

list();
