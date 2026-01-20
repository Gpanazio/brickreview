import request from 'supertest';
import { app } from '../index.js'; // Ensure index.js exports app

describe('Health Check API', () => {
    it('should return 200 OK', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toEqual('ok');
    });
});
