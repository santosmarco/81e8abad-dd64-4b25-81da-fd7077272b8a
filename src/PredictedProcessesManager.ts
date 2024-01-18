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

  public async runAll(signal?: AbortSignal): Promise<void> {
    try {
      const promises = await Promise.allSettled(
        this.processes.map((process) => process.run(signal)),
      );
      const hasAnError = promises.some((item) => item.status === 'rejected');
      if (hasAnError) {
        throw new Error();
      }
    } catch (error) {
      throw error;
    }
  }
}
