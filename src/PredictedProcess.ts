import { spawn, type ChildProcess } from 'child_process';

export class PredictedProcess {
  private _childProcess: ChildProcess | null = null;

  private _memoizedProcesses: Map<string, PredictedProcess> = new Map();

  private _hasRunSuccesfully: boolean = false;

  private _hasEncounteredError: boolean = false;

  private _runningPromise: Promise<void> | null = null;

  public constructor(
    public readonly id: number,
    public readonly command: string,
  ) { }

  /**
   * Spawns and manages a child process to execute a given command, with handling for an optional AbortSignal.
   *
   * WRITE UP:
   * (Please provide a detailed explanation of your approach, specifically the reasoning behind your design decisions. This can be done _after_ the 1h30m time limit.)
   *
   * I'll do the explanations tomorrow. It's 2 am right now in Turkiye. 
   *
   */
  public async run(signal?: AbortSignal): Promise<void> {
    if (this._hasRunSuccesfully) {
      return;
    }

    if (
      this._runningPromise &&
      !signal?.aborted &&
      !this._hasEncounteredError
    ) {
      return this._runningPromise;
    }

    const cleanUp = () => {
      if (this._childProcess) {
        this._childProcess.kill();
        this._childProcess.removeAllListeners();
        this._childProcess = null;
        this._hasRunSuccesfully = false;
      }
    };

    this._runningPromise = new Promise((resolve, reject) => {
      if (this._childProcess) {
        cleanUp();
        this._hasEncounteredError = true;
        return reject(new Error('Process is already running'));
      }

      if (signal && signal.aborted) {
        cleanUp();
        this._hasEncounteredError = true;
        return reject(new Error('Signal already aborted'));
      }

      this._childProcess = spawn(this.command, { shell: true });

      this._childProcess.on('error', (err) => {
        cleanUp();
        this._hasEncounteredError = true;
        return reject(err);
      });

      this._childProcess.on('close', (code) => {
        cleanUp();

        if (code === 0) {
          this._hasRunSuccesfully = true;
          resolve();
        } else {
          this._hasEncounteredError = true;
          return reject(new Error(`Process exited with code ${code}`));
        }
      });

      this._childProcess.on('exit', (code) => {
        cleanUp();
        if (code === 0) {
          this._hasRunSuccesfully = true;
          resolve();
        } else {
          cleanUp();
          this._hasEncounteredError = true;
          return reject(new Error(`Process exited with code ${code}`));
        }
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          cleanUp();
          this._hasEncounteredError = true;
          return reject(new Error('Process aborted by signal'));
        });
      }
    });

    return this._runningPromise;
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
    const key = this.command;

    let memoizedProcess = this._memoizedProcesses.get(key);
    if (memoizedProcess && memoizedProcess._hasRunSuccesfully) {
      return memoizedProcess;
    }

    memoizedProcess = new PredictedProcess(this.id, this.command);
    this._memoizedProcesses.set(key, memoizedProcess);
    return memoizedProcess;
  }
}