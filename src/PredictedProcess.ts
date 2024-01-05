import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import {
  AbortException,
  AlreadyAbortedException,
  SpawnProcessCloseException,
  SpawnProcessFailureException,
} from './errors';
import { debug } from './utils';

export class PredictedProcess {
  private _memoized = false;

  private _memory: WeakMap<AbortSignal, ChildProcess> | null = null;

  // This hack is only used because there is an issue in last test case mocking, which changes original behaviour of ChildProcess.on function
  // For more details search for # FIXME in PredicatedProcess.spec.ts
  private _onCloseCallbacks: Function[] = [];

  public constructor(
    public readonly id: number,
    public readonly command: string,
  ) {}

  /**
   * Spawns and manages a child process to execute a given command, with handling for an optional AbortSignal.
   *
   * WRITE UP:
   * (Please provide a detailed explanation of your approach, specifically the reasoning behind your design decisions. This can be done _after_ the 1h30m time limit.)
   *
   * ...
   *
   */
  public async run(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new AlreadyAbortedException();
    }

    await new Promise((resolve, reject) => {
      const process = this.makeProcess(this.command, signal);

      process.on('error', (error) => {
        debug(`Process ${this.id} error:`, error);
        this.forget(signal);
        reject(new SpawnProcessFailureException(error));
      });

      this._onCloseCallbacks.push(
        (code: number | null, closeSignal: NodeJS.Signals | null) => {
          debug(`Process ${this.id} close: ${code} ${closeSignal}`);

          if (code === 0) {
            resolve(undefined);
          } else {
            this.forget(signal);

            reject(new SpawnProcessCloseException(code, closeSignal));
          }

          process.kill();
        },
      );

      process.on('close', (code, signal) => {
        this._onCloseCallbacks.map((cb) => cb(code, signal));
      });

      process.on('message', (message) => {
        debug(`Process received message: `, message);
      });

      process.on('spawn', () => {
        debug(`Process spawned! id - ${this.id}`);
      });
    });
  }

  /**
   * Returns a memoized version of `PredictedProcess`.
   *
   * WRITE UP:
   * (Please provide a detailed explanation of your approach, specifically the reasoning behind your design decisions. This can be done _after_ the 1h30m time limit.)
   *
   * Memoize function returns copy instance with memoization enabled
   *
   */
  public memoize(): PredictedProcess {
    const newInstance = new PredictedProcess(this.id, this.command);

    newInstance._memoized = true;

    return newInstance;
  }

  private makeProcess(command: string, signal?: AbortSignal): ChildProcess {
    if (this._memoized && signal && this._memory?.has(signal)) {
      debug(`Get memoized process ${this.id}`);

      return this._memory.get(signal) as ChildProcess;
    }

    const process = spawn(command, { signal });

    debug(`Spawn process ${this.id}`);

    if (this._memoized && signal) {
      this.remember(process, signal);
    }
    return process;
  }

  private remember(process: ChildProcess, signal: AbortSignal) {
    this._memory = this._memory || new Map();

    this._memory.set(signal, process);
  }

  private forget(signal?: AbortSignal | null) {
    if (!signal || !this._memoized) return;

    this._memory = this._memory || new Map();

    this._memory.delete(signal);
  }
}
