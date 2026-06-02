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
        const regularExpenses = expenses.filter(exp => exp.category !== 'Préstamo');
        const totalRegularSpent = regularExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

        const loanOutflows = expenses.filter(exp => exp.category === 'Préstamo' && parseFloat(exp.amount) > 0);
        const totalLentThisPeriod = loanOutflows.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

        const loanRecoveries = expenses.filter(exp => exp.category === 'Préstamo' && parseFloat(exp.amount) < 0);
        const totalRecoveredThisPeriod = loanRecoveries.reduce((sum, exp) => sum + Math.abs(parseFloat(exp.amount)), 0);

        let totalRecoveredOldLoans = 0;
        if (activePeriod) {
            const toLimaDateString = (dateInput) => {
                return new Date(dateInput).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
            };
            const activePeriodStartStr = toLimaDateString(activePeriod.start_date);

            loanRecoveries.forEach(recovery => {
                const personName = recovery.name.replace('Abono Préstamo: ', '').trim();
                const matchedLoan = loans.find(l => l.person_name.toLowerCase() === personName.toLowerCase());
                if (matchedLoan) {
                    const loanDateStr = toLimaDateString(matchedLoan.date);
                    if (loanDateStr < activePeriodStartStr) {
                        totalRecoveredOldLoans += Math.abs(parseFloat(recovery.amount));
                    }
                }
            });
        }

        const totalRecoveredCurrentPeriodLoans = totalRecoveredThisPeriod - totalRecoveredOldLoans;

        const adjustedBudget = budget + totalRecoveredOldLoans;

        let totalSpent = totalRegularSpent + totalLentThisPeriod - totalRecoveredCurrentPeriodLoans;
        if (Math.abs(totalSpent) < 0.005) {
            totalSpent = 0;
        }

        let balance = adjustedBudget - totalSpent;
        if (Math.abs(balance) < 0.005) {
            balance = 0;
        }

        const categoryData = regularExpenses.reduce((acc, exp) => {
            const cat = exp.category || 'Otros';
            acc[cat] = (acc[cat] || 0) + parseFloat(exp.amount);
            return acc;
        }, {});

        if (totalLentThisPeriod > 0) {
            categoryData['Préstamo'] = (categoryData['Préstamo'] || 0) + totalLentThisPeriod;
        }
        if (totalRecoveredThisPeriod > 0) {
            categoryData['Préstamo'] = (categoryData['Préstamo'] || 0) - totalRecoveredThisPeriod;
        }

        const totalPendingLoans = loans
            .filter(l => l.status === 'pending')
            .reduce((sum, l) => sum + (parseFloat(l.amount) - parseFloat(l.paid_amount || 0)), 0);
        const totalPaidLoans = loans
            .reduce((sum, l) => sum + parseFloat(l.paid_amount || 0), 0);

        res.render('dashboard', {
            budget: adjustedBudget,
            totalSpent,
            balance,
            categoryData,
            loanStats: {
                totalPending: totalPendingLoans,
                totalPaid: totalPaidLoans
            },
            expenses,
            loans: loans.filter(l => !l.is_archived),
            periodName,
            dateRange,
            username: req.session.username
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.get('/users', async (req, res) => {
    if (req.session.role !== 'ADMIN') return res.status(403).send('Acceso denegado');
    try {
        const usersRes = await db.query('SELECT id, username, email, phone, role, is_active, expires_at FROM users ORDER BY id ASC');
        res.render('dashboard/users', {
            username: req.session.username,
            users: usersRes.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/users/toggle/:id', async (req, res) => {
    if (req.session.role !== 'ADMIN') return res.status(403).send('Acceso denegado');
    try {
        await db.query('UPDATE users SET is_active = NOT is_active WHERE id = $1', [req.params.id]);
        res.redirect('/dashboard/users');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/users/expire/:id', async (req, res) => {
    if (req.session.role !== 'ADMIN') return res.status(403).send('Acceso denegado');
    try {
        const expiresAt = req.body.expires_at || null;
        await db.query('UPDATE users SET expires_at = $1 WHERE id = $2', [expiresAt, req.params.id]);
        res.redirect('/dashboard/users');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
