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

   * cleanUp: It kills the child process, remove all the listeners from child process, equals to null and sets false to hasRunSuccesfully state.
   * _runningPromise: it is flag that is there any runningpromise
   * _hasEncounteredError: this is a state of encountered error with type boolean
   * _hasRunSuccesfully:this is a state of run success with type boolean
   * _memoizedProcesses:  it is flag that is there any memoizedprocess
   * _childProcess: It creates a child process
   * 
   * should reject if the signal is already aborted: i checked if signal exists.
   * 
   * should reject if the process terminates with an error: i checked the signal exists and aborted at the same time.
   * 
   * should resolve if the process terminates successfully: if code is "0" success it terminated successfully
   * 
   * should cleanup after process completion: it kills child processes, remove listeners after completion
   * 
   * should reject subsequent calls with the same aborted signal  : it sends 2 signals, accept the first one but rejects the second one.
   * 
   * should handle call without an AbortSignal: it takes a code and if it is "0" resolves.
   * 
   * should reject immediately if the signal is already aborted : it checks the signal exists and aborted sets _hasEncounteredError=true and rejects 
   * 
   * should not cache results of executions that encounter errors or are aborted: cleans up cache data and doesn't caches the executions
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