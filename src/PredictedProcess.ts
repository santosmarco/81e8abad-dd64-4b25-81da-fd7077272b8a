import { ChildProcess, spawn } from 'child_process';
import {
  ExistingProcessRunningError,
  SignalAbortedError,
  WhileExcecutionError,
} from './Errors';

export class PredictedProcess {
  private _childProcess: ChildProcess | null = null;
  private _memoStore: { [key: string]: PredictedProcess } = {};

  public constructor(
    public readonly id: number,
    public readonly command: string,
  ) {}

  public getRegister = () => String(this.id) + String(this.command.trim());

  public run = async (signal?: AbortSignal): Promise<void> => {
    if (signal?.aborted) {
      throw new SignalAbortedError('Signal already aborted');
    }

    if (this._childProcess) {
      throw new ExistingProcessRunningError();
    }

    const promiseToExcecute = new Promise<void>((res, rej) => {
      this._childProcess = spawn(this.command, { shell: true });

      const handleCleanup = (): void => {
        if (this._childProcess) {
          this._childProcess.removeAllListeners();
          this._childProcess.kill();
          this._childProcess = null;
        }
      };

      const handleClose = (code: number | null): void => {
        if (Number(code) === 0) res();

        handleCleanup();
      };

      const handleError = (): void => {
        handleCleanup();
        rej(new WhileExcecutionError());
      };

      this._childProcess.on('close', handleClose);
      this._childProcess.on('error', handleError);
    });

    const key = this.getRegister();

    this._memoStore[key] = this;

    await promiseToExcecute;
  };

  public memoize = (): PredictedProcess => {
    const register = this.getRegister();

    if (this._memoStore[register]) {
      return this._memoStore[register];
    }

    this._memoStore[register] = this;

    return this;
  };
}
