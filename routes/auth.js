const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const bcrypt = require('bcryptjs');

router.get('/login', (req, res) => {
    if (req.session.isLoggedIn) return res.redirect('/dashboard');
    res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (await bcrypt.compare(password, user.password)) {
                req.session.isLoggedIn = true;
                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.success = `¡Bienvenido de nuevo, ${user.username}!`;
                return res.redirect('/dashboard');
            }
        }
        req.session.error = 'Credenciales inválidas. Por favor, verifica tu usuario y contraseña.';
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        req.session.error = 'Ocurrió un error técnico al intentar iniciar sesión.';
        res.redirect('/login');
    }
});

router.get('/register', (req, res) => {
    if (req.session.isLoggedIn) return res.redirect('/dashboard');
    res.render('register', { error: null });
});

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userExists = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userExists.rows.length > 0) {
            req.session.error = 'El usuario ya existe';
            return res.redirect('/register');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        req.session.success = 'Cuenta creada con éxito. Ya puedes iniciar sesión.';
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        req.session.error = 'Ocurrió un error al registrar el usuario. Inténtalo de nuevo.';
        res.redirect('/register');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
