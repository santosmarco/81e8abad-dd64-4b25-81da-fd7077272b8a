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

  /*
  * Executes all managed PredictedProcess instances concurrently, handling both successful and rejected outcomes.
  * Propagates errors appropriately for consumption by the calling code.
  * Key design decisions:
  *  - Uses Promise.allSettled to capture both resolved and rejected promises.
  *  - Throws an error if any processes are rejected to signal failure to the calling code.
  *  - Preserves error propagation through a try/catch block for external errors.
  */
  public async runAll(signal?: AbortSignal): Promise<void> {
    try {
        const results = await Promise.allSettled(this.processes.map((process) => process.run(signal))); 
        const hasError = results.some((result) => result.status === 'rejected');
        if (hasError) {
          throw new Error();
        }
    } catch (error: any) {
        throw error;
    }
  }
}

