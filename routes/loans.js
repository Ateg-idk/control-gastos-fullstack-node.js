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
        const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        await db.query('BEGIN');

        await db.query('INSERT INTO loans (user_id, person_name, amount, date, description, from_budget) VALUES ($1, $2, $3, $4, $5, $6)',
            [userId, person_name, amount, date || todayDate, description || '', isFromBudget]);

        if (isFromBudget) {
            await db.query('INSERT INTO expenses (user_id, name, amount, date, description, category) VALUES ($1, $2, $3, $4, $5, $6)',
                [userId, `Préstamo a ${person_name}`, amount, date || todayDate, `Capital restado del presupuesto: ${description}`, 'Préstamo']);
        }

        await db.query('COMMIT');
        res.redirect('/loans');
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/pay/:id', async (req, res) => {
    const userId = req.session.userId;
    const paymentAmount = parseFloat(req.body.amount || 0);

    try {
        if (paymentAmount <= 0) return res.redirect('/loans');

        const loanRes = await db.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
        if (loanRes.rows.length > 0) {
            const loan = loanRes.rows[0];
            if (loan.status === 'paid') return res.redirect('/loans');

            const currentPaid = parseFloat(loan.paid_amount || 0);
            const totalAmount = parseFloat(loan.amount);
            let newPaid = currentPaid + paymentAmount;

            if (newPaid > totalAmount) newPaid = totalAmount;

            const actualPayment = newPaid - currentPaid;
            const newStatus = newPaid >= totalAmount ? 'paid' : 'pending';
            const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

            await db.query('BEGIN');
            await db.query('UPDATE loans SET paid_amount = $1, status = $2, payment_date = $3 WHERE id = $4 AND user_id = $5',
                [newPaid, newStatus, newStatus === 'paid' ? todayDate : null, req.params.id, userId]);

            if (loan.from_budget && actualPayment > 0) {
                await db.query('INSERT INTO expenses (user_id, name, amount, date, description, category) VALUES ($1, $2, $3, $4, $5, $6)',
                    [userId, `Abono Préstamo: ${loan.person_name}`, -actualPayment, todayDate, `Abono de S/ ${actualPayment.toFixed(2)} por préstamo del ${new Date(loan.date).toLocaleDateString('es-ES')}`, 'Préstamo']);
            }
            await db.query('COMMIT');
        }
        res.redirect('/loans?updated=true');
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/undo/:id', async (req, res) => {
    const userId = req.session.userId;
    try {
        const loanRes = await db.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
        if (loanRes.rows.length > 0) {
            const loan = loanRes.rows[0];
            const paidAmount = parseFloat(loan.paid_amount || 0);

            await db.query('BEGIN');
            await db.query('UPDATE loans SET status = $1, payment_date = NULL, paid_amount = 0 WHERE id = $2 AND user_id = $3',
                ['pending', req.params.id, userId]);

            if (loan.from_budget && paidAmount > 0) {
                const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
                await db.query('INSERT INTO expenses (user_id, name, amount, date, description, category) VALUES ($1, $2, $3, $4, $5, $6)',
                    [userId, `Extorno Cobro: ${loan.person_name}`, paidAmount, todayDate, `Re-apertura de deuda pendiente`, 'Préstamo']);
            }
            await db.query('COMMIT');
        }
        res.redirect('/loans?updated=true');
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/delete/:id', async (req, res) => {
    const userId = req.session.userId;
    try {
        const loanRes = await db.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
        if (loanRes.rows.length > 0) {
            const loan = loanRes.rows[0];

            await db.query('BEGIN');
            await db.query('DELETE FROM loans WHERE id = $1 AND user_id = $2', [req.params.id, userId]);

            if (loan.from_budget) {
                if (loan.status === 'pending') {
                    await db.query('INSERT INTO expenses (user_id, name, amount, date, description, category) VALUES ($1, $2, $3, $4, $5, $6)',
                        [userId, `Cancelación Préstamo: ${loan.person_name}`, -parseFloat(loan.amount), new Date(), `Restauración por préstamo eliminado`, 'Préstamo']);
                } else if (loan.status === 'paid') {
                }
            }

            await db.query('COMMIT');
        }
        res.redirect('/loans?updated=true');
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/edit/:id', async (req, res) => {
    const { person_name, amount, date, description, from_budget } = req.body;
    const userId = req.session.userId;
    const isFromBudget = from_budget === 'true';

    try {
        const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        await db.query('BEGIN');

        const loanRes = await db.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
        if (loanRes.rows.length > 0) {
            const oldLoan = loanRes.rows[0];

            await db.query(`
                UPDATE loans 
                SET person_name = $1, amount = $2, date = $3, description = $4, from_budget = $5
                WHERE id = $6 AND user_id = $7
            `, [person_name, amount, date || todayDate, description || '', isFromBudget, req.params.id, userId]);

            if (oldLoan.from_budget && isFromBudget && oldLoan.status === 'pending') {
                await db.query(`
                    UPDATE expenses 
                    SET amount = $1, name = $2 
                    WHERE user_id = $3 AND category = 'Préstamo' AND name = $4
                `, [amount, `Préstamo a ${person_name}`, userId, `Préstamo a ${oldLoan.person_name}`]);
            }
        }

        await db.query('COMMIT');
        res.redirect('/loans?updated=true');
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
