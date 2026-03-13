const app = require('./app');
const request = require('supertest');

async function test() {
    try {
        const resReg = await request(app).get('/register');
        console.log('GET /register status:', resReg.status);

        const resLoansAdd = await request(app).post('/loans/add');
        console.log('POST /loans/add status:', resLoansAdd.status);
    } catch (e) {
        console.error('Test failed:', e);
    }
    process.exit();
}

test();
