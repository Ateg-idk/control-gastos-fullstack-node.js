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
        const loanRes = await db.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
        if (loanRes.rows.length > 0) {
            const loan = loanRes.rows[0];
            const newStatus = loan.status === 'pending' ? 'paid' : 'pending';

            await db.query('BEGIN');

            await db.query('UPDATE loans SET status = $1, payment_date = $2 WHERE id = $3 AND user_id = $4',
                [newStatus, newStatus === 'paid' ? new Date() : null, req.params.id, userId]);

            if (loan.from_budget) {
                if (newStatus === 'paid') {
                    await db.query('INSERT INTO expenses (user_id, name, amount, date, description, category) VALUES ($1, $2, $3, $4, $5, $6)',
                        [userId, `Cobro Préstamo: ${loan.person_name}`, -parseFloat(loan.amount), new Date(), `Recuperación de capital por préstamo realizado el ${new Date(loan.date).toLocaleDateString()}`, 'Préstamo']);
                } else {
                    await db.query('INSERT INTO expenses (user_id, name, amount, date, description, category) VALUES ($1, $2, $3, $4, $5, $6)',
                        [userId, `Extorno Cobro: ${loan.person_name}`, parseFloat(loan.amount), new Date(), `Re-apertura de deuda pendiente`, 'Préstamo']);
                }
            }

            await db.query('COMMIT');
        }
        res.redirect('/loans?updated=true');
    } catch (err) {
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

            // Delete the master loan
            await db.query('DELETE FROM loans WHERE id = $1 AND user_id = $2', [req.params.id, userId]);

            // Budget adjustment logic upon deletion
            if (loan.from_budget) {
                if (loan.status === 'pending') {
                    // It was pending, so it was "subtracting" from the budget. 
                    // To cancel it, we restore the money.
                    await db.query('INSERT INTO expenses (user_id, name, amount, date, description, category) VALUES ($1, $2, $3, $4, $5, $6)',
                        [userId, `Cancelación Préstamo: ${loan.person_name}`, -parseFloat(loan.amount), new Date(), `Restauración por préstamo eliminado`, 'Préstamo']);
                } else if (loan.status === 'paid') {
                    // It was already paid, so balance was restored.
                    // Deleting the loan might imply we want to remove the "repayment" revenue too?
                    // User says the loan Master Record is the source of truth.
                    // If we delete a PAID loan, we should probably ensure the "Final Balance" remains consistent.
                    // However, normally people delete loans to "undo" them.
                    // For now, let's stick to the user's focus: "si borro ahí recién se descuenta".
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

module.exports = router;
