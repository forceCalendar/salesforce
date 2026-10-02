const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    // Match the engine bundled with the Salesforce runner. State-testing peers
    // may hoist a newer LWC engine with incompatible module and compiler formats.
    moduleNameMapper: {
        ...jestConfig.moduleNameMapper,
        '^(lwc|@lwc/engine-dom)$': require.resolve('@lwc/engine-dom', {
            paths: [require.resolve('@salesforce/sfdx-lwc-jest')],
        }),
    },
};
