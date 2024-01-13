import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';

export class PredictedProcess {
  private _childProcess: ChildProcess | null = null;

  private _isMemoized: boolean = false;
  private _lastSignal: AbortSignal | null = null;
  private _isCached: boolean = false;

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
    return new Promise((resolve, reject) => {
      // functions for error and close events:
      const unbindAndKill = () => {
          this._childProcess?.removeAllListeners();
          this._childProcess?.stderr?.removeAllListeners();
          this._childProcess?.stdout?.removeAllListeners();
          this.killQuietly();
        },
        handleError = (error: Error) => {
          unbindAndKill();
          this._isCached = false;
          return reject(new Error(`Process error: ${error}`));
        },
        handleClose = (code: number | null) => {
          unbindAndKill();
          if (code === 0) {
            resolve();
          } else {
            this._isCached = false;
            reject(new Error(`Process exited with code ${code}`));
          }
        };

      if (signal?.aborted) {
        this._isCached = false;
        return reject(new Error('Signal already aborted'));
      }

      // Handle memoization:
      if (
        this._isMemoized &&
        signal &&
        this._lastSignal === signal &&
        this._isCached
      ) {
        return resolve();
      }

      this._childProcess = spawn(this.command, { signal, shell: true });

      if (signal) this._lastSignal = signal;

      this._isCached = true;

      // Bind events:
      this._childProcess.on('error', handleError);
      this._childProcess.on('close', handleClose);

      // Bind stdout and stderr events:
      this._childProcess.stderr?.on('data', handleError);
      // this._childProcess.stdout?.on('data', (data) => {
      //   console.log(`stdout: ${data}`);
      // });
    });
  }

  /**
   * Returns a memoized version of `PredictedProcess`.
   *
   * WRITE UP:
   * (Please provide a detailed explanation of your approach, specifically the reasoning behind your design decisions. This can be done _after_ the 1h30m time limit.)
   *
   * ...
   *
   */
  public memoize(): PredictedProcess {
    this._isMemoized = true;
    this._lastSignal = null;
    this._isCached = false;
    return this;
  }

  private killQuietly(): void {
    try {
      this._childProcess?.kill();
    } catch (ex) {
      // Ignore
    }
  }
}
