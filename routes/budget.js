const express = require('express');
const router = express.Router();
const db = require('../lib/db');

router.get('/', async (req, res) => {
    const userId = req.session.userId;
    try {
        const activePeriodRes = await db.query('SELECT * FROM public.budget_periods WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1', [userId]);
        const historyRes = await db.query('SELECT * FROM public.budget_periods WHERE user_id = $1 AND is_active = FALSE ORDER BY end_date DESC', [userId]);

        res.render('budget/manage', {
            activePeriod: activePeriodRes.rows[0] || null,
            history: historyRes.rows,
            username: req.session.username
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});
router.post('/add', async (req, res) => {
    const { name, amount, start_date, end_date } = req.body;
    const userId = req.session.userId;

    try {
        await db.query('UPDATE public.budget_periods SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE', [userId]);

        await db.query(`
            INSERT INTO public.budget_periods (user_id, name, amount, start_date, end_date, is_active)
            VALUES ($1, $2, $3, $4, $5, TRUE)
        `, [userId, name, amount, start_date, end_date]);

        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});
router.post('/close/:id', async (req, res) => {
    const userId = req.session.userId;
    try {
        await db.query('UPDATE public.budget_periods SET is_active = FALSE WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
        res.redirect('/budget');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/edit/:id', async (req, res) => {
    const { name, amount, start_date, end_date } = req.body;
    const userId = req.session.userId;
    try {
        await db.query(`
            UPDATE public.budget_periods
            SET name = $1, amount = $2, start_date = $3, end_date = $4
            WHERE id = $5 AND user_id = $6
        `, [name, amount, start_date, end_date, req.params.id, userId]);
        res.redirect('/budget');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
