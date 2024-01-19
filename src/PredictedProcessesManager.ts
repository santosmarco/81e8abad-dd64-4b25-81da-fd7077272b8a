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
   * Executes multiple predicted processes.
   *
   * WRITE UP:
   * (Please provide a detailed explanation of your approach, specifically the reasoning behind your design decisions. This can be done _after_ the 1h30m time limit.)
   *
   should resolve after all processes exit successfully :if process lengts is higher than 0 it passes 
   should reject if an AbortSignal is triggered during execution : it throws reject if abort signal triggers
   should reject if at least one process terminates with an error :if has error code it rejects
   *
   */
  public async runAll(signal?: AbortSignal): Promise<void> {
    if (this._processes.length === 0) {
      throw new Error('No processes to run');
    }

    const processPromises = this._processes.map(process => process.run(signal));

    try {
      await Promise.all(processPromises);
    } catch (error) {
      throw error;
    }
  }
}