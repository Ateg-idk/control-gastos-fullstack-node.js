const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const bcrypt = require('bcryptjs');

router.get('/login', (req, res) => {
    if (req.session.isLoggedIn) return res.redirect('/dashboard');
    res.render('login');
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (await bcrypt.compare(password, user.password)) {
                if (!user.is_active) {
                    req.session.error = 'Tu cuenta aún no ha sido activada u aprobada por un Administrador. Por favor, espera a la habilitación.';
                    return res.redirect('/login');
                }

                if (user.expires_at) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const expiry = new Date(user.expires_at);
                    expiry.setHours(0, 0, 0, 0);
                    // Add 1 day buffer to inclusive expiration date (it expires AFTER that day ends)
                    expiry.setDate(expiry.getDate() + 1);
                    if (today >= expiry) {
                        req.session.error = 'Tu suscripción ha vencido. Por favor, contacta a tu administrador para renovar tu acceso.';
                        return res.redirect('/login');
                    }
                }

                req.session.isLoggedIn = true;
                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.role = user.role;
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
    res.render('register');
});

router.post('/register', async (req, res) => {
    const { username, password, email, phone } = req.body;

    // Validación backend de email y teléfono
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{9}$/;

    if (!emailRegex.test(email)) {
        req.session.error = 'Por favor, ingresa un correo electrónico válido.';
        return res.redirect('/register');
    }

    if (!phoneRegex.test(phone)) {
        req.session.error = 'El número de celular debe tener exactamente 9 dígitos.';
        return res.redirect('/register');
    }

    try {
        const usernameCheck = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (usernameCheck.rows.length > 0) {
            req.session.error = 'El nombre de usuario "' + username + '" ya está en uso. Por favor, elige otro.';
            return res.redirect('/register');
        }

        const emailCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
            req.session.error = 'El correo electrónico ya está registrado. Intenta con otro o inicia sesión.';
            return res.redirect('/register');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (username, password, role, is_active, email, phone) VALUES ($1, $2, \'CLIENT\', false, $3, $4)', [username, hashedPassword, email, phone]);
        req.session.success = 'Cuenta creada con éxito. Un administrador debe aprobar tu acceso antes de iniciar sesión.';
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
