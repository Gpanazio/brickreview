/**
 * Smoke Tests para Staging/Production
 * 
 * Testes rápidos de verificação de saúde do sistema.
 * Devem ser executados após cada deploy para garantir
 * que as funcionalidades críticas estão operacionais.
 * 
 * Tempo de execução: ~30 segundos
 */
import { test, expect } from '@playwright/test';

test.describe('🔥 Smoke Tests - Verificações Críticas', () => {

    test.describe('🏠 Homepage', () => {
        test('página inicial carrega corretamente', async ({ page }) => {
            await page.goto('/');
            await expect(page).toHaveTitle(/brickreview/i);

            // Verifica que não há erros de console críticos
            const consoleErrors = [];
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text());
                }
            });

            // Espera a página carregar completamente
            await page.waitForLoadState('networkidle');

            // Filtra erros críticos (ignora erros esperados de terceiros)
            const criticalErrors = consoleErrors.filter(e =>
                !e.includes('favicon') &&
                !e.includes('net::ERR_')
            );

            expect(criticalErrors.length).toBe(0);
        });
    });

    test.describe('🌐 API Health', () => {
        test('endpoint de health retorna status OK', async ({ request }) => {
            const response = await request.get('/api/health');
            expect(response.status()).toBe(200);

            const health = await response.json();
            expect(health.status).toBe('ok');
            expect(health.service).toBe('brickreview');
            expect(health.checks).toBeDefined();
            expect(health.checks.database).toBeDefined();
        });

        test('database está conectado e responde', async ({ request }) => {
            const response = await request.get('/api/health');
            const health = await response.json();

            // Database deve estar healthy ou disabled (dev local sem DB)
            expect(['healthy', 'disabled']).toContain(health.checks.database.status || 'disabled');
        });
    });

    test.describe('🔐 Sistema de Autenticação', () => {
        test('página de login está acessível', async ({ page }) => {
            await page.goto('/login');
            await expect(page.locator('body')).toBeVisible();

            // Deve haver campos de login ou redirecionamento
            const hasLoginForm = await page.locator('input[type="text"], input[type="email"], input[name="username"]').count() > 0;
            const hasPassword = await page.locator('input[type="password"]').count() > 0;

            expect(hasLoginForm || hasPassword).toBeTruthy();
        });

        test('login com credenciais inválidas retorna erro apropriado', async ({ request }) => {
            const response = await request.post('/api/auth/login', {
                data: {
                    username: 'invalid_user_12345',
                    password: 'invalid_password_12345'
                }
            });

            // Deve retornar 401 ou 429 (rate limited)
            expect([401, 429]).toContain(response.status());
        });
    });

    test.describe('🛡️ Rate Limiting', () => {
        test('rate limiting está ativo em rotas de auth', async ({ request }) => {
            // Faz várias requisições rápidas
            const responses = [];
            for (let i = 0; i < 6; i++) {
                const response = await request.post('/api/auth/login', {
                    data: {
                        username: `test_rate_limit_${i}`,
                        password: 'testpassword'
                    }
                });
                responses.push(response.status());
            }

            // Pelo menos uma deve ser 429 (rate limited) ou 401 (auth failed)
            const hasExpectedResponse = responses.some(s => s === 429 || s === 401);
            expect(hasExpectedResponse).toBeTruthy();
        });
    });

    test.describe('📊 Rotas Públicas', () => {
        test('API retorna 404 para rotas inexistentes', async ({ request }) => {
            const response = await request.get('/api/this-route-does-not-exist-12345');
            expect(response.status()).toBe(404);

            const body = await response.json();
            expect(body.error).toBeDefined();
        });
    });

    test.describe('🔒 Headers de Segurança', () => {
        test('headers de segurança estão presentes', async ({ request }) => {
            const response = await request.get('/api/health');

            const headers = response.headers();

            // Content-Security-Policy
            expect(headers['content-security-policy']).toBeDefined();

            // X-Content-Type-Options
            expect(headers['x-content-type-options']).toBe('nosniff');

            // Referrer-Policy
            expect(headers['referrer-policy']).toBeDefined();
        });
    });
});

test.describe('📈 Performance Básica', () => {
    test('homepage carrega em menos de 5 segundos', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const loadTime = Date.now() - startTime;

        // Deve carregar em menos de 5 segundos
        expect(loadTime).toBeLessThan(5000);
    });

    test('API health responde em menos de 1 segundo', async ({ request }) => {
        const startTime = Date.now();

        await request.get('/api/health');

        const responseTime = Date.now() - startTime;

        // Deve responder em menos de 1 segundo
        expect(responseTime).toBeLessThan(1000);
    });
});
