export default {
    testEnvironment: 'node',
    transform: {}, // No transform needed for native ESM
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1', // Handle .js extensions if needed
    },
    verbose: true,
    testMatch: ['**/server/tests/**/*.test.js'],
    setupFilesAfterEnv: ['./server/tests/setup.js'] // Optional setup
};
