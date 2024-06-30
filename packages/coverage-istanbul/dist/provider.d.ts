import { CoverageProvider, Vitest, AfterSuiteRunMeta, ReportContext, ResolvedCoverageOptions } from 'vitest';
import { BaseCoverageProvider } from 'vitest/coverage';
import { CoverageMap } from 'istanbul-lib-coverage';
import { Instrumenter } from 'istanbul-lib-instrument';

type Options = ResolvedCoverageOptions<'istanbul'>;
type Filename = string;
type CoverageFilesByTransformMode = Record<AfterSuiteRunMeta['transformMode'], Filename[]>;
type ProjectName = NonNullable<AfterSuiteRunMeta['projectName']> | typeof DEFAULT_PROJECT;
interface TestExclude {
    new (opts: {
        cwd?: string | string[];
        include?: string | string[];
        exclude?: string | string[];
        extension?: string | string[];
        excludeNodeModules?: boolean;
        relativePath?: boolean;
    }): {
        shouldInstrument: (filePath: string) => boolean;
        glob: (cwd: string) => Promise<string[]>;
    };
}
declare const DEFAULT_PROJECT: unique symbol;
declare class IstanbulCoverageProvider extends BaseCoverageProvider implements CoverageProvider {
    name: string;
    ctx: Vitest;
    options: Options;
    instrumenter: Instrumenter;
    testExclude: InstanceType<TestExclude>;
    coverageFiles: Map<ProjectName, CoverageFilesByTransformMode>;
    coverageFilesDirectory: string;
    pendingPromises: Promise<void>[];
    initialize(ctx: Vitest): void;
    resolveOptions(): Options;
    onFileTransform(sourceCode: string, id: string, pluginCtx: any): {
        code: string;
        map: any;
    } | undefined;
    onAfterSuiteRun({ coverage, transformMode, projectName }: AfterSuiteRunMeta): void;
    clean(clean?: boolean): Promise<void>;
    reportCoverage({ allTestsRun }?: ReportContext): Promise<void>;
    getCoverageMapForUncoveredFiles(coveredFiles: string[]): Promise<CoverageMap>;
}

export { IstanbulCoverageProvider };
