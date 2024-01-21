import { AbortSignal } from 'abort-controller';
import type { PredictedProcess } from './PredictedProcess';

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
   * Executes multiple predicted processes concurrently.
   */
  public async runAll(signal?: AbortSignal): Promise<void> {
    // Create an array to store all the promises of process executions
    const executionPromises: Promise<void>[] = [];

    // Iterate through each process and execute it concurrently
    for (const process of this._processes) {
      // Use a conditional to pass the signal only if it's defined
      const executionPromise = process.run(
        signal !== undefined ? signal : undefined,
      );

      // Add the promise to the array
      executionPromises.push(executionPromise);
    }

    // Wait for all promises to settle (resolve or reject)
    await Promise.allSettled(executionPromises);

    // Handle process completion or abortion
    for (const process of this._processes) {
      // Check if an AbortSignal is provided and activated
      if (signal && signal.aborted) {
        // Cleanup the ongoing process externally
        process.cleanupExternal();
      }
    }

    // Check if any process has failed (rejected)
    const hasFailed = executionPromises.some((promise) => {
      try {
        promise.catch(() => {});
        return true;
      } catch {
        return false;
      }
    });

    // Either resolve or reject based on the overall outcome
    if (signal && signal.aborted) {
      // Reject if an AbortSignal is triggered
      throw new Error('Execution aborted by signal.');
    } else if (hasFailed) {
      // Reject if any process has failed
      throw new Error('One or more processes failed.');
    } else {
      // Resolve if all processes have completed successfully
      return Promise.resolve();
    }
  }
}
