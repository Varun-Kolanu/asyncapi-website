/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
    verbose: true,
    collectCoverage: true,
    coverageReporters: ['text', 'lcov', 'json-summary'],
    coverageDirectory: 'coverage',
    collectCoverageFrom: ['scripts/**/*.ts', 'scripts/**/*.js'],
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    preset: 'ts-jest',
    testEnvironment: "node",
    // To disallow netlify edge function tests from running
    testMatch: ['**/tests/**/*.test.*', '!**/netlify/**/*.test.*'],
    transform: {
        "^.+.ts$": ["ts-jest", { isolatedModules: true }],
    },
};