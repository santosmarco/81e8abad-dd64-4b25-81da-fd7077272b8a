import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';

export class PredictedProcess {
  private _childProcess: ChildProcess | null = null;

  public constructor(
    public readonly id: number,
    public readonly command: string,
  ) {}

  /**
   * Spawns and manages a child process to execute a given command, with handling for an optional AbortSignal.
   *
  1.Early Exit for Aborted Signal: The method first checks if an AbortSignal is provided and if it's already aborted. 
  This preemptive check ensures the method does not start a process that's meant to be aborted immediately, adhering to the principle of efficiency and error handling.
  
  2.Singleton Process Execution: The method then checks if a child process is already running. 
  If so, it throws an error to prevent multiple instances of the same process from running concurrently. 
  This design decision enforces the singleton nature of the process execution, ensuring resource management is controlled and predictable, thereby improving the code's efficiency and reliability.
  
  3.Promise-based Asynchronous Execution: The core execution of the child process is wrapped in a Promise.
  This approach aligns with modern asynchronous programming practices in JavaScript, allowing the method to be used in an asynchronous context with await, providing better readability and integration with other asynchronous operations.
  
  4.Process Spawning: A child process is spawned using the spawn function from Node.js's child_process module. 
  The method uses the command stored in the PredictedProcess instance, and shell: true is specified to allow shell command execution. 
  This makes the method flexible, supporting a wide range of commands.
  
  5.Cleanup Mechanism: A cleanup function is defined to encapsulate the actions required to clean up the process upon completion or error. 
  This includes removing all listeners attached to the process and killing the process if it's still running. 
  This cleanup ensures that resources are properly released, preventing potential memory leaks and other resource management issues.
  
  6.AbortSignal Handling: If an AbortSignal is provided, an event listener is attached to handle the 'abort' event. 
  Upon abortion, the cleanup function is called, and the promise is rejected with an appropriate error message. 
  This feature allows external control of the process execution, which is essential for scenarios where a process needs to be terminated prematurely.
  
  7.Process Completion and Error Handling: Event listeners for 'close' and 'error' are attached to the child process.
    On 'close', the cleanup function is invoked. If the process exits with a code of 0, indicating success, the promise is resolved.
      Otherwise, it's rejected with an error stating the exit code.
    On 'error', the promise is rejected with the error occurred, and cleanup is also invoked. This ensures robust error handling.
   *
   */
  public async run(signal?: AbortSignal): Promise<void> {
    // Early exit if the signal is already aborted
    if (signal?.aborted) {
      throw new Error('Signal already aborted');
    }

    // Only allow one instance of the process to run at a time
    if (this._childProcess) {
      throw new Error('Process is already running');
    }

    return new Promise<void>((resolve, reject) => {
      this._childProcess = spawn(this.command, { shell: true });

      const cleanup = () => {
        this._childProcess?.removeAllListeners();
        this._childProcess?.kill();
        this._childProcess = null;
      };

      const handleAbort = () => {
        cleanup();
        reject(new Error('Process aborted due to signal'));
      };

      signal?.addEventListener('abort', handleAbort, { once: true });

      this._childProcess.on('close', (code: number) => {
        cleanup();
        code === 0
          ? resolve()
          : reject(new Error(`Process exited with code ${code}`));
      });

      this._childProcess.on('error', (err: Error) => {
        cleanup();
        reject(err);
      });
    });
  }

  /**
   * Returns a memoized version of `PredictedProcess`.
   *
   * 
  1.Caching Strategy: The memoization is based on the AbortSignal. 
  The method caches the result of the run method call (a promise) and returns this cached result for subsequent calls with the same AbortSignal. 
  This approach assumes that if the run method is called with the same AbortSignal, the underlying process and its outcome would be identical, thus eliminating the need to spawn a new process.

  2.AbortSignal as a Key: The use of the AbortSignal as the key for caching is a deliberate choice. 
  It allows the method to differentiate between different invocations based on their abort conditions. 
  This is particularly useful in scenarios where the process might be controlled or aborted externally, and different signals represent different control flows.

  3.Handling Failed Executions: The method ensures that results of failed executions (where the promise is rejected) are not cached. 
  This is achieved by resetting lastResult to null in the catch block of the promise. 
  It prevents the reuse of failed results in subsequent calls, ensuring that a new process is spawned in case of prior failures.

  4.Idempotency: The method maintains the idempotency of the run method. 
  If run is called multiple times with the same signal without the signal being aborted or the process failing, it will not unnecessarily spawn new processes. 
  This design decision improves performance and resource utilization.

  5.Return of the Same Instance: The method returns the same PredictedProcess instance with an altered run method. 
  This approach preserves the existing instance's state and properties, providing a seamless experience for the caller.
   *  
   *
   */
  public memoize(): PredictedProcess {
    let lastResult: Promise<void> | null = null;
    let lastSignal: AbortSignal | undefined;

    const originalRun = this.run;

    this.run = (signal?: AbortSignal) => {
      if (signal === lastSignal) {
        return lastResult ?? originalRun.call(this, signal);
      }

      lastSignal = signal;
      lastResult = originalRun.call(this, signal).catch((error) => {
        if (signal === lastSignal) {
          lastResult = null;
        }
        throw error;
      });

      return lastResult;
    };

    return this;
  }
}
