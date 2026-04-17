const express = require('express');
const router = express.Router();
const db = require('../lib/db');

router.get('/', async (req, res) => {
    const userId = req.session.userId;
    const { search, day: dayFilter, week: weekFilter, filter, page } = req.query;
    try {
        const isValidDate = (d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d);
        const isValidWeek = (w) => w && /^\d{4}-W\d{2}$/.test(w);

        const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        const PET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
        PET.setHours(12, 0, 0, 0);
        const currentDay = PET.getDay();
        const diff = PET.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
        const currentStartOfWeek = new Date(PET.setDate(diff)).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

        let baseQuery = ' FROM expenses WHERE user_id = $1';
        let params = [userId];

        let statsTargetDay = todayDate;
        let statsTargetWeekStart = currentStartOfWeek;
        const tempPET = new Date(currentStartOfWeek + 'T12:00:00');
        let statsTargetWeekEnd = new Date(tempPET.setDate(tempPET.getDate() + 6)).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

        if (filter === 'today') {
            baseQuery += ' AND date = $' + (params.length + 1);
            params.push(todayDate);
        } else if (filter === 'week') {
            baseQuery += ' AND date >= $' + (params.length + 1);
            params.push(currentStartOfWeek);
        } else if (filter === 'all') {
        } else if (isValidDate(dayFilter)) {
            baseQuery += ' AND date = $' + (params.length + 1);
            params.push(dayFilter);
            statsTargetDay = dayFilter;
        } else if (isValidWeek(weekFilter)) {
            const [year, week] = weekFilter.split('-W').map(Number);
            const d = new Date(year, 0, 1, 12, 0, 0);
            const dw = d.getDay();
            d.setDate(d.getDate() - dw + (dw === 0 ? -6 : 1) + (week - 1) * 7);
            statsTargetWeekStart = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
            d.setDate(d.getDate() + 6);
            statsTargetWeekEnd = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

            baseQuery += ' AND date >= $' + (params.length + 1) + ' AND date <= $' + (params.length + 2);
            params.push(statsTargetWeekStart, statsTargetWeekEnd);
        } else if (!search) {
            baseQuery += ' AND date >= $' + (params.length + 1);
            params.push(currentStartOfWeek);
        }

        if (search) {
            baseQuery += ' AND name ILIKE $' + (params.length + 1);
            params.push(`%${search}%`);
        }
        const countRes = await db.query('SELECT COUNT(*)' + baseQuery, params);
        const totalRecords = parseInt(countRes.rows[0].count);
        const limit = 20;
        const totalPages = Math.ceil(totalRecords / limit) || 1;
        const currentPage = Math.max(1, Math.min(parseInt(page) || 1, totalPages));
        const offset = (currentPage - 1) * limit;
        const dataQuery = 'SELECT *' + baseQuery + ' ORDER BY date DESC, id DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        const paramsWithPagination = [...params, limit, offset];
        const expensesRes = await db.query(dataQuery, paramsWithPagination);
        let statsQuery = `
            SELECT 
                COALESCE(SUM(CASE WHEN date = $2 THEN amount ELSE 0 END), 0) as daily_total,
                COALESCE(SUM(CASE WHEN date >= $3 ${statsTargetWeekEnd ? 'AND date <= $4' : ''} THEN amount ELSE 0 END), 0) as weekly_total
            FROM expenses 
            WHERE user_id = $1 AND category != 'Préstamo' AND amount > 0
        `;
        let statsParams = [userId, statsTargetDay, statsTargetWeekStart];
        if (statsTargetWeekEnd) statsParams.push(statsTargetWeekEnd);

        const statsRes = await db.query(statsQuery, statsParams);

        res.render('expenses/index', {
            expenses: expensesRes.rows,
            dailyTotal: parseFloat(statsRes.rows[0].daily_total),
            weeklyTotal: parseFloat(statsRes.rows[0].weekly_total),
            username: req.session.username,
            filters: { search, day: isValidDate(dayFilter) ? dayFilter : '', week: isValidWeek(weekFilter) ? weekFilter : '', filter: filter || (!search && !dayFilter && !weekFilter ? 'week' : '') },
            pagination: { currentPage, totalPages, totalRecords },
            statsLabels: {
                day: isValidDate(dayFilter) ? 'Día Seleccionado' : 'Gastos de Hoy',
                week: isValidWeek(weekFilter) ? 'Semana Seleccionada' : 'Gastos de la Semana',
                weekRange: { start: statsTargetWeekStart, end: statsTargetWeekEnd }
            }
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
        const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        await db.query('INSERT INTO expenses (user_id, name, amount, date, description, category) VALUES ($1, $2, $3, $4, $5, $6)',
            [userId, name, amount, date || todayDate, description || '', category || 'Otros']);
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
        const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        await db.query(`
            UPDATE expenses 
            SET name = $1, amount = $2, date = $3, description = $4, category = $5
            WHERE id = $6 AND user_id = $7
        `, [name, amount, date || todayDate, description || '', category || 'Otros', req.params.id, userId]);
        res.redirect('/expenses');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
