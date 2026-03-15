const express = require('express');
const router = express.Router();
const db = require('../lib/db');

router.get('/', async (req, res) => {
    const userId = req.session.userId;
    const { search, month } = req.query;
    try {
        let query = 'SELECT * FROM expenses WHERE user_id = $1';
        let params = [userId];

        if (month) {
            query += ' AND TO_CHAR(date, \'YYYY-MM\') = $' + (params.length + 1);
            params.push(month);
        }
        if (search) {
            query += ' AND name ILIKE $' + (params.length + 1);
            params.push(`%${search}%`);
        }
        query += ' ORDER BY date DESC, id DESC';

        const expensesRes = await db.query(query, params);
        res.render('expenses/index', {
            expenses: expensesRes.rows,
            username: req.session.username,
            filters: { search, month }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.get('/add', (req, res) => {
    res.render('expenses/add', { username: req.session.username });
});

router.post('/add', async (req, res) => {
    const { name, amount, date, description, category } = req.body;
    const userId = req.session.userId;
    try {
        await db.query('INSERT INTO expenses (user_id, name, amount, date, description, category) VALUES ($1, $2, $3, $4, $5, $6)',
            [userId, name, amount, date || new Date(), description || '', category || 'Otros']);
        res.redirect('/expenses');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/delete/:id', async (req, res) => {
    const userId = req.session.userId;
    try {
        await db.query('DELETE FROM expenses WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
        res.redirect('/expenses');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/edit/:id', async (req, res) => {
    const { name, amount, date, description, category } = req.body;
    const userId = req.session.userId;
    try {
        await db.query(`
            UPDATE expenses 
            SET name = $1, amount = $2, date = $3, description = $4, category = $5
            WHERE id = $6 AND user_id = $7
        `, [name, amount, date || new Date(), description || '', category || 'Otros', req.params.id, userId]);
        res.redirect('/expenses');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
