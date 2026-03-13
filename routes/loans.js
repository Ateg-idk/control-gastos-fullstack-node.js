const express = require('express');
const router = express.Router();
const db = require('../lib/db');

router.get('/', async (req, res) => {
    const userId = req.session.userId;
    try {
        const result = await db.query('SELECT * FROM loans WHERE user_id = $1 ORDER BY date DESC, id DESC', [userId]);
        res.render('loans/index', {
            loans: result.rows,
            username: req.session.username
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/add', async (req, res) => {
    const { person_name, amount, date, description, from_budget } = req.body;
    const userId = req.session.userId;
    const isFromBudget = from_budget === 'true';

    try {
        await db.query('BEGIN');
        
        await db.query('INSERT INTO loans (user_id, person_name, amount, date, description, from_budget) VALUES ($1, $2, $3, $4, $5, $6)',
            [userId, person_name, amount, date || new Date(), description || '', isFromBudget]);

        if (isFromBudget) {
            await db.query('INSERT INTO expenses (user_id, name, amount, date, description, category) VALUES ($1, $2, $3, $4, $5, $6)',
                [userId, `Préstamo a ${person_name}`, amount, date || new Date(), `Capital restado del presupuesto: ${description}`, 'Préstamo']);
        }

        await db.query('COMMIT');
        res.redirect('/loans');
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/toggle/:id', async (req, res) => {
    const userId = req.session.userId;
    try {
        const loanRes = await db.query('SELECT status FROM loans WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
        if (loanRes.rows.length > 0) {
            const newStatus = loanRes.rows[0].status === 'pending' ? 'paid' : 'pending';
            await db.query('UPDATE loans SET status = $1 WHERE id = $2 AND user_id = $3', [newStatus, req.params.id, userId]);
        }
        res.redirect('/loans');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/delete/:id', async (req, res) => {
    const userId = req.session.userId;
    try {
        await db.query('DELETE FROM loans WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
        res.redirect('/loans');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
