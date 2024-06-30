import { IstanbulCoverageProvider } from './provider.js';
import 'vitest';
import 'vitest/coverage';
import 'istanbul-lib-coverage';
import 'istanbul-lib-instrument';

declare function getProvider(): Promise<IstanbulCoverageProvider>;
declare function takeCoverage(): any;
declare const _default: {
    getProvider: typeof getProvider;
    takeCoverage: typeof takeCoverage;
};

export { _default as default, getProvider, takeCoverage };