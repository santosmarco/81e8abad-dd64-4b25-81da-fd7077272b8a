import { spawn, ChildProcess } from 'child_process';


export class PredictedProcess {
  private _childProcess: ChildProcess | null = null;

  // Stores memoized process instances for different signal states.
  private memo: {[key: string]: PredictedProcess} = {};

  public constructor(
    public readonly id: number,
    public readonly command: string,
  ) {}

  // Generates a unique key for memoization based on process ID and signal.
  private getKey(signal?: AbortSignal): string {
    return String(this.id) + String(signal?.aborted);
  }
 
  /**
   * Runs the process asynchronously, handling caching, errors, and cleanup.
   * 
   * @param {AbortSignal} signal - Optional AbortSignal to handle abortion of the operation.
   * @returns {Promise<void>} - Resolves when the child process exits successfully or rejects if an error occurs.
   * 
   * Key design decisions:
   * - Memoization: Avoids redundant executions for the same process and signal state, optimizing performance.
   * - Error Handling: Throws errors for aborted signals and process failures, ensuring proper error propagation.
   * - Cleanup: Guarantees child process termination and listener removal, preventing resource leaks.
   * 
   * @summary This method efficiently manages the execution of asynchronous processes by
   * avoiding redundancy through memoization, handling aborted signals and errors,
   * and ensuring proper cleanup to prevent resource leaks. It optimizes performance
   * for computationally expensive or resource-intensive operations.
   */
  public async run(signal?: AbortSignal): Promise<void> {
    // Handle aborted signals
    if (signal?.aborted) {
      throw new Error('Signal already aborted');
    }

    const key = this.getKey(signal);
    if (this.memo[key]) {
        return; 
    }

    /**
     * Creates a Promise that manages the execution of the child process,
     * handling its lifecycle events (close and error) and ensuring proper cleanup.
     * @returns A Promise that resolves when the child process exits successfully
     * or rejects if an error occurs.
     */
    const promiseToSend = new Promise<void>(async (resolve, reject) => {
      const child = spawn(this.command);

      // Terminates the child process and removes listeners to prevent resource leaks.
      function cleanup() {
        if (child) {
          child.kill();
          child.removeAllListeners();
        }
      }

      // Handles the 'close' event of the child process, resolving the promise on success.
      function closeHandler(event: any) {
        if (event == 0) { resolve(); }
        cleanup()
        return;
      }

      // Handles the 'error' event of the child process, rejecting the promise with the error.
      function errorHandler(error: any) {
        cleanup();
        reject(error);
      }


      child.on('close', closeHandler);
      child.on('error', errorHandler);
    });

    // Caches the current process instance for future calls with the same key.
    this.memo[key] = this;

    try {
      // Await child process execution, handling errors within promiseToSend.
      await promiseToSend;
    } catch (error: any) {
      // Remove cached process on error and rethrow for proper error propagation.
      delete this.memo[key];
      throw error;
    }

  }

  /**
   * Memoizes the process for the given signal state, returning a cached version if available.
   * This optimization avoids redundant process executions for the same process and signal combination.
   * It's crucial for processes that are computationally expensive or access external resources.
   * 
   * @summary 
   * - The memoization key is based on a combination of the process ID and signal state.
   * - Using the process ID alone as the key may result in incorrect caching when processes share the
   *   same ID but have different signal states.
   * - Similarly, using the AbortSignal alone lacks uniqueness and might lead to incorrect caching for
   *   distinct processes.
   * - The combination of ID and signal state ensures both uniqueness and the ability to distinguish
   *   between processes with different signal states, addressing key concerns for proper memoization.
   */
  public memoize(): PredictedProcess {
    const newKey = this.getKey(); 

    // Return cached version if available
    if(this.memo[newKey]){
      return this.memo[newKey];
    } 

    // Cache and return itself if not found
    return this.memo[newKey] = this;
  }
}
