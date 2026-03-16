const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Global messages middleware
app.use((req, res, next) => {
    res.locals.error = req.session.error || null;
    res.locals.success = req.session.success || null;
    res.locals.role = req.session.role || null;
    res.locals.todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    delete req.session.error;
    delete req.session.success;
    next();
});

const isAuthenticated = (req, res, next) => {
    if (req.session.isLoggedIn) {
        return next();
    }
    res.redirect('/login');
};

const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const budgetRoutes = require('./routes/budget');
const loanRoutes = require('./routes/loans');

app.use('/', authRoutes);
app.use('/dashboard', isAuthenticated, dashboardRoutes);
app.use('/expenses', isAuthenticated, expenseRoutes);
app.use('/budget', isAuthenticated, budgetRoutes);
app.use('/loans', isAuthenticated, loanRoutes);

app.get('/', (req, res) => {
    if (req.session.isLoggedIn) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

const server = app.listen(PORT, '0.0.0.0', () => {
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ El puerto ${PORT} está ocupado. Por favor, cierra otros procesos de Node.`);
        process.exit(1);
    } else {
        console.error('❌ Error al iniciar el servidor:', err);
    }
});

process.on('SIGTERM', () => {
    console.log('SIGTERM recibido. Cerrando servidor...');
    server.close(() => process.exit(0));
});
