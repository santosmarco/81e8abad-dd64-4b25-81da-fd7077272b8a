import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { AbortController, AbortSignal } from 'abort-controller';

export class PredictedProcess {
  private _childProcess: ChildProcessWithoutNullStreams | null = null;

  public constructor(
    public readonly id: number,
    public readonly command: string,
  ) {}

  /**
   * Spawns and manages a child process to execute a given command, with handling for an optional AbortSignal.
   */
  public async run(signal?: AbortSignal): Promise<void> {
    // Ensure cleanup if the process was already running
    this.cleanup();

    const controller = new AbortController();
    const { signal: abortSignal } = controller;

    try {
      // Associate the provided signal or create a new one
      const finalSignal = signal || abortSignal;

      // Spawn the child process
      this._childProcess = spawn(this.command, [], {
        // TODO: You can customize options here if needed.
        // For example, you might want to set the 'stdio' option.
      });

      // Handle process completion
      this._childProcess.on('exit', (code, signal) => {
        if (code === 0) {
          // Resolve on successful execution
          controller.abort();
        } else {
          // Reject on errors
          controller.abort();
        }
      });

      // Handle process abortion using the AbortSignal
      finalSignal.addEventListener('abort', () => {
        // Cleanup and reject on abortion
        this.cleanup();
        controller.abort();
      });

      // Optionally, you can listen for errors during the spawn
      this._childProcess.on('error', (error) => {
        // Reject on spawn errors
        console.error('Error spawning process:', error);
        this.cleanup();
        controller.abort();
      });

      // Optionally, you can handle stdout and stderr if needed
      // this._childProcess.stdout.on('data', (data) => console.log(`stdout: ${data}`));
      // this._childProcess.stderr.on('data', (data) => console.error(`stderr: ${data}`));

      // Await the process completion or abortion
      await finalSignal.aborted;
    } catch (error) {
      // Reject on unexpected errors
      console.error('Unexpected error:', error);
      this.cleanup();
      controller.abort();
    }
  }

  /**
   * Returns a memoized version of `PredictedProcess`.
   * This is useful for optimizing repeated executions with the same AbortSignal, avoiding unnecessary spawning.
   */
  public memoize(): PredictedProcess {
    // Return a new instance with the same id and command
    return new PredictedProcess(this.id, this.command);
  }

  /**
   * Expose a method to perform cleanup externally.
   * This method can be used by the manager to clean up the process.
   */
  public cleanupExternal(): void {
    this.cleanup();
  }

  /**
   * Clean up the child process and associated event listeners.
   */
  private cleanup(): void {
    if (this._childProcess) {
      this._childProcess.removeAllListeners();
      this._childProcess.kill();
      this._childProcess = null;
    }
  }
}
