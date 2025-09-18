declare namespace NodeJS {
  type Timeout = number;
  type Timer = number;
  interface Process {
    env: Record<string, string | undefined>;
  }
}

declare const process: NodeJS.Process;

declare function require(moduleName: string): unknown;

declare class Buffer extends Uint8Array {
  static from(data: string | ArrayBuffer | ArrayBufferView | Uint8Array, encoding?: string): Buffer;
  static alloc(size: number, fill?: string | Uint8Array, encoding?: string): Buffer;
  static byteLength(string: string, encoding?: string): number;
  constructor(input: ArrayBuffer | ArrayBufferView);
  toString(encoding?: string): string;
}

interface ErrorConstructor {
  captureStackTrace?(targetObject: object, constructorOpt?: (...args: unknown[]) => unknown): void;
}
