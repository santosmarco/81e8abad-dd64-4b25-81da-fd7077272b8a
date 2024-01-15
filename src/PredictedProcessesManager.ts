import type { PredictedProcess } from './PredictedProcess';
import { spawn } from 'child_process';

export class PredictedProcessesManager {
  private _processes: PredictedProcess[] = [];

  public constructor(processes: readonly PredictedProcess[] = []) {
    this._processes = processes.slice();
  }

  public get processes(): readonly PredictedProcess[] {
    return this._processes.slice();
  }

  public addProcess(process: PredictedProcess): this {
    this._processes.push(process);
    return this;
  }

  public removeProcess(id: number): this {
    this._processes = this._processes.filter((process) => process.id !== id);
    return this;
  }

  public getProcess(id: number): PredictedProcess | undefined {
    return this.processes.find((process) => process.id === id);
  }

  /**
   * Executes multiple predicted processes.
   *
   * 
  1.Concurrent Execution with Promise.allSettled: The method uses Promise.allSettled to execute all subprocesses concurrently. 
  This approach ensures that all processes are given a chance to complete, regardless of whether some may fail or succeed. 
  The use of Promise.allSettled over Promise.all is crucial as it doesn't immediately reject upon the first error, allowing for the collection of results (or errors) from all subprocesses.

  2.Signal-Based Abortion: The method accepts an optional AbortSignal. 
  If the signal is already aborted before the method starts, it throws an error immediately. 
  During execution, if the signal is aborted, all running subprocesses are terminated, and their respective promises are rejected. 
  This feature provides a mechanism to externally control the execution of these processes.

  3.Error Handling and Cleanup: Each subprocess is monitored for 'error' and 'close' events. 
  The cleanUp function is called in any termination scenario to remove event listeners and terminate the subprocess. 
  This ensures that resources are properly managed and prevents potential memory leaks or subprocesses lingering in the background.

  4.Error Propagation: If any subprocess exits with an error or a non-zero exit code, or if an abort signal is triggered, the corresponding promise is rejected with a descriptive error. 
  After all subprocesses have settled, the method checks for any rejections and throws an error if found. This ensures that errors in subprocesses are not silently ignored and are properly communicated to the caller.

  5.Efficiency and Resource Management: By spawning subprocesses concurrently and cleaning up resources in all termination scenarios, the method optimizes performance and resource utilization. 
  This is particularly important when managing multiple subprocesses, as it minimizes the overhead and potential impact on system resources.
   *
   */
  public async runAll(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new Error(
        'Abort signal already triggered before starting processes.',
      );
    }

    const processPromises = this._processes.map((process) => {
      return new Promise<void>((resolve, reject) => {
        const processInstance = spawn(process.command, { shell: true });
        let hasErrorOccurred = false;

        const cleanUp = () => {
          processInstance.removeAllListeners();
          processInstance.kill(); // Safely terminate the process
        };

        processInstance.on('error', (err: Error) => {
          hasErrorOccurred = true;
          cleanUp();
          reject(
            new Error(
              `Process ${process.id} exited with error: ${err.message}`,
            ),
          );
        });

        processInstance.on('close', (code: number) => {
          cleanUp();
          if (code !== 0 || hasErrorOccurred) {
            reject(new Error(`Process ${process.id} exited with code ${code}`));
          } else {
            resolve();
          }
        });

        if (signal) {
          const handleAbort = () => {
            cleanUp();
            reject(new Error(`Process ${process.id} aborted due to signal`));
          };
          signal.addEventListener('abort', handleAbort, { once: true });

          if (signal.aborted) {
            cleanUp();
            reject(
              new Error(
                `Process ${process.id} already aborted due to initial signal`,
              ),
            );
          }
        }
      });
    });

    const results = await Promise.allSettled(processPromises);
    const firstRejection = results.find(
      (result) => result.status === 'rejected',
    );

    if (firstRejection) {
      throw (firstRejection as PromiseRejectedResult).reason;
    }
  }
}
