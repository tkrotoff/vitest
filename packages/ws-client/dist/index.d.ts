import { BirpcReturn } from 'birpc';
import { WebSocketEvents, WebSocketHandlers } from 'vitest';
import { File, Task, TaskResultPack, Suite } from '@vitest/runner';
export { getNames, getSuites, getTasks, getTests, hasFailed, hasTests } from '@vitest/runner/utils';

type Arrayable<T> = T | Array<T>;
interface UserConsoleLog {
    content: string;
    type: 'stdout' | 'stderr';
    taskId?: string;
    time: number;
    size: number;
}

declare class StateManager {
    filesMap: Map<string, File[]>;
    pathsSet: Set<string>;
    idMap: Map<string, Task>;
    taskFileMap: WeakMap<Task, File>;
    errorsSet: Set<unknown>;
    processTimeoutCauses: Set<string>;
    catchError(err: unknown, type: string): void;
    clearErrors(): void;
    getUnhandledErrors(): unknown[];
    addProcessTimeoutCause(cause: string): void;
    getProcessTimeoutCauses(): string[];
    getPaths(): string[];
    getFiles(keys?: string[]): File[];
    getFilepaths(): string[];
    getFailedFilepaths(): string[];
    collectPaths(paths?: string[]): void;
    collectFiles(files?: File[]): void;
    clearFiles(_project: {
        config: {
            name: string;
        };
    }, paths?: string[]): void;
    updateId(task: Task): void;
    updateTasks(packs: TaskResultPack[]): void;
    updateUserLog(log: UserConsoleLog): void;
    getCountOfFailedTests(): number;
    cancelFiles(files: string[], root: string, projectName: string): void;
}

declare function hasBenchmark(suite: Arrayable<Suite>): boolean;
declare function hasFailedSnapshot(suite: Arrayable<Task>): boolean;
declare function getFullName(task: Task, separator?: string): string;

interface VitestClientOptions {
    handlers?: Partial<WebSocketEvents>;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    reconnectTries?: number;
    connectTimeout?: number;
    reactive?: <T>(v: T) => T;
    ref?: <T>(v: T) => {
        value: T;
    };
    WebSocketConstructor?: typeof WebSocket;
}
interface VitestClient {
    ws: WebSocket;
    state: StateManager;
    rpc: BirpcReturn<WebSocketHandlers, WebSocketEvents>;
    waitForConnection: () => Promise<void>;
    reconnect: () => Promise<void>;
}
declare function createClient(url: string, options?: VitestClientOptions): VitestClient;

export { type VitestClient, type VitestClientOptions, createClient, getFullName, hasBenchmark, hasFailedSnapshot };
