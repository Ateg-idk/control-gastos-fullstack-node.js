const express = require('express');
const router = express.Router();
const db = require('../lib/db');

router.get('/', async (req, res) => {
    const userId = req.session.userId;
    const { search, start_date, end_date, page } = req.query;

    try {
        // Fetch Overall Stats
        const statsRes = await db.query(`
            SELECT 
                SUM(total_amount) as total, 
                SUM(paid_amount) as paid,
                COUNT(*) FILTER (WHERE status != 'paid') as pending_count
            FROM fixed_costs 
            WHERE user_id = $1
        `, [userId]);
        
        const totals = statsRes.rows[0];
        const totalPaid = parseFloat(totals.paid || 0);
        const totalOverall = parseFloat(totals.total || 0);
        const totalPending = totalOverall - totalPaid;
        const pendingCount = parseInt(totals.pending_count || 0);

        let baseQuery = ' FROM fixed_costs WHERE user_id = $1';
        let params = [userId];

        if (search) {
            baseQuery += ' AND name ILIKE $' + (params.length + 1);
            params.push(`%${search}%`);
        }

        if (start_date) {
            baseQuery += ' AND start_date >= $' + (params.length + 1);
            params.push(start_date);
        }

        if (end_date) {
            baseQuery += ' AND start_date <= $' + (params.length + 1);
            params.push(end_date);
        }

        const countRes = await db.query('SELECT COUNT(*)' + baseQuery, params);
        const totalRecords = parseInt(countRes.rows[0].count);
        const limit = 10;
        const totalPages = Math.ceil(totalRecords / limit) || 1;
        const currentPage = Math.max(1, Math.min(parseInt(page) || 1, totalPages));
        const offset = (currentPage - 1) * limit;

        const dataQuery = 'SELECT *' + baseQuery + ' ORDER BY status ASC, start_date DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        const fixedCostsRes = await db.query(dataQuery, [...params, limit, offset]);

        res.render('fixed_costs/index', {
            fixedCosts: fixedCostsRes.rows,
            username: req.session.username,
            filters: { search, start_date, end_date },
            pagination: { currentPage, totalPages, totalRecords },
            stats: { totalPaid, totalOverall, totalPending, pendingCount }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/add', async (req, res) => {
    const { name, total_amount, monthly_amount, description, is_installment, total_installments, start_date } = req.body;
    const userId = req.session.userId;
    const installment = is_installment === 'true';

    try {
        const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        await db.query(`
            INSERT INTO fixed_costs (user_id, name, total_amount, monthly_amount, description, is_installment, total_installments, start_date, paid_amount)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
        `, [userId, name, total_amount || monthly_amount, monthly_amount, description || '', installment, installment ? total_installments : null, start_date || todayDate]);

        res.redirect('/fixed-costs');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Partial or total payment (Adelanto)
router.post('/pay/:id', async (req, res) => {
    const userId = req.session.userId;
    const paymentAmount = parseFloat(req.body.amount || 0);

    try {
        if (paymentAmount <= 0) return res.redirect('/fixed-costs');

        const result = await db.query('SELECT * FROM fixed_costs WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
        if (result.rows.length > 0) {
            const item = result.rows[0];
            const currentPaid = parseFloat(item.paid_amount || 0);
            const totalAmount = parseFloat(item.total_amount);

            // Validation: prevent overpayment
            if (currentPaid + paymentAmount > totalAmount) {
                // We could send an error message via session here
                return res.redirect('/fixed-costs?error=overpaid');
            }

            const newPaid = currentPaid + paymentAmount;
            const newStatus = newPaid >= totalAmount ? 'paid' : 'active';
            const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

            // Calculate paid installments based on total paid vs monthly amount
            let newPaidInstallments = item.paid_installments;
            if (item.is_installment && item.monthly_amount > 0) {
                newPaidInstallments = Math.floor(newPaid / item.monthly_amount);
                if (newPaidInstallments > item.total_installments) newPaidInstallments = item.total_installments;
            }

            await db.query(`
                UPDATE fixed_costs 
                SET paid_amount = $1, status = $2, last_payment_date = $3, paid_installments = $4 
                WHERE id = $5
            `, [newPaid, newStatus, todayDate, newPaidInstallments, req.params.id]);
        }
        res.redirect('/fixed-costs?success=paid');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Edit
router.post('/edit/:id', async (req, res) => {
    const { name, total_amount, monthly_amount, description, is_installment, total_installments, start_date } = req.body;
    const userId = req.session.userId;
    const installment = is_installment === 'true';

    try {
        const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

        await db.query(`
            UPDATE fixed_costs 
            SET name = $1, total_amount = $2, monthly_amount = $3, description = $4, is_installment = $5, total_installments = $6, start_date = $7
            WHERE id = $8 AND user_id = $9
        `, [name, total_amount, monthly_amount, description || '', installment, installment ? total_installments : null, start_date || todayDate, req.params.id, userId]);

        res.redirect('/fixed-costs?success=updated');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Delete
router.post('/delete/:id', async (req, res) => {
    const userId = req.session.userId;
    try {
        await db.query('DELETE FROM fixed_costs WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
        res.redirect('/fixed-costs');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
