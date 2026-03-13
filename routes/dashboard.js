const express = require('express');
const router = express.Router();
const db = require('../lib/db');

router.get('/', async (req, res) => {
    try {
        const userId = req.session.userId;
        const periodRes = await db.query(
            "SELECT * FROM public.budget_periods WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1",
            [userId]
        );
        const activePeriod = periodRes.rows[0];

        let budget = 0;
        let expenses = [];
        let periodName = 'Sin Periodo Activo';
        let dateRange = 'Configura un periodo en Presupuesto';

        if (activePeriod) {
            budget = parseFloat(activePeriod.amount);
            periodName = activePeriod.name;
            dateRange = `${new Date(activePeriod.start_date).toLocaleDateString()} - ${new Date(activePeriod.end_date).toLocaleDateString()}`;
            const expensesRes = await db.query(
                `SELECT * FROM expenses 
                 WHERE user_id = $1 
                 AND date >= $2 AND date <= $3 
                 ORDER BY date DESC, id DESC`,
                [userId, activePeriod.start_date, activePeriod.end_date]
            );
            expenses = expensesRes.rows;
        }
        const loansRes = await db.query('SELECT * FROM loans WHERE user_id = $1 ORDER BY status DESC, date DESC', [userId]);
        const loans = loansRes.rows;

        const totalSpent = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
        const balance = budget - totalSpent;
        const categoryData = expenses.reduce((acc, exp) => {
            const cat = exp.category || 'Otros';
            acc[cat] = (acc[cat] || 0) + parseFloat(exp.amount);
            return acc;
        }, {});

        const totalPendingLoans = loans
            .filter(l => l.status === 'pending')
            .reduce((sum, l) => sum + parseFloat(l.amount), 0);
        const totalPaidLoans = loans
            .filter(l => l.status === 'paid')
            .reduce((sum, l) => sum + parseFloat(l.amount), 0);

        res.render('dashboard', {
            budget,
            totalSpent,
            balance,
            categoryData,
            loanStats: {
                totalPending: totalPendingLoans,
                totalPaid: totalPaidLoans
            },
            expenses,
            loans,
            periodName,
            dateRange,
            username: req.session.username
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
