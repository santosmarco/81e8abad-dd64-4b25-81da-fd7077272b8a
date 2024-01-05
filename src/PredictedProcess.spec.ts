import { spawn } from 'child_process';

import { PredictedProcess } from './PredictedProcess';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.useFakeTimers();

describe('PredictedProcess', () => {
  let process: PredictedProcess;

  beforeEach(() => {
    process = new PredictedProcess(1, 'test command');
  });

  test('should reject if the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(process.run(controller.signal)).rejects.toThrow();
  });

  test('should reject if the process terminates with an error', async () => {
    (spawn as jest.Mock).mockImplementation(() => ({
      on: (event: string, callback: Function) => {
        if (event === 'error') {
          callback(new Error('Process error'));
        }
      },
      kill: jest.fn(),
      removeAllListeners: jest.fn(),
    }));
    await expect(process.run()).rejects.toThrow();
  });

  test('should resolve if the process terminates successfully', async () => {
    (spawn as jest.Mock).mockImplementation(() => ({
      on: (event: string, callback: Function) => {
        if (event === 'close') {
          callback(0); // exit code 0 for success
        }
      },
      kill: jest.fn(),
      removeAllListeners: jest.fn(),
    }));
    await expect(process.run()).resolves.toBeUndefined();
  });

  test('should reject if the AbortSignal is triggered during execution', async () => {
    const controller = new AbortController();
    jest.advanceTimersByTime(1000); // Advance timers by 1 second
    controller.abort(); // Abort after advancing timers

    (spawn as jest.Mock).mockImplementation(() => ({
      on: jest.fn(),
      kill: jest.fn(),
      removeAllListeners: jest.fn(),
    }));

    await expect(process.run(controller.signal)).rejects.toThrow();
  });

  test('should cleanup after process completion', async () => {
    const mockKill = jest.fn();
    (spawn as jest.Mock).mockImplementation(() => ({
      on: (event: string, callback: Function) => {
        if (event === 'close') {
          callback(0);
        }
      },
      kill: mockKill,
      removeAllListeners: jest.fn(),
    }));

    await process.run();
    expect(mockKill).toHaveBeenCalled();
  });

  test('should reject subsequent calls with the same aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(process.run(controller.signal)).rejects.toThrow();
    await expect(process.run(controller.signal)).rejects.toThrow();
  });

  test('should handle varying commands consistently', async () => {
    const processA = new PredictedProcess(2, 'command A');
    const processB = new PredictedProcess(3, 'command B');

    (spawn as jest.Mock).mockImplementation(() => ({
      on: (event: string, callback: Function) => {
        if (event === 'close') {
          callback(0); // simulate success
        }
      },
      kill: jest.fn(),
      removeAllListeners: jest.fn(),
    }));

    await expect(processA.run()).resolves.toBeUndefined();
    await expect(processB.run()).resolves.toBeUndefined();
  });

  test('should handle call without an AbortSignal', async () => {
    (spawn as jest.Mock).mockImplementation(() => ({
      on: (event: string, callback: Function) => {
        if (event === 'close') {
          callback(0);
        }
      },
      kill: jest.fn(),
      removeAllListeners: jest.fn(),
    }));

    await expect(process.run()).resolves.toBeUndefined();
  });

  test('should return immediately for subsequent calls with the same signal after successful execution', async () => {
    const memoizedProcess = process.memoize();
    const controller = new AbortController();

    const mockSpawn = (spawn as jest.Mock).mockImplementation(() => ({
      on: (event: string, callback: Function) => {
        if (event === 'close') callback(0);
      },
      kill: jest.fn(),
      removeAllListeners: jest.fn(),
    }));

    await memoizedProcess.run(controller.signal);
    mockSpawn.mockClear();
    await memoizedProcess.run(controller.signal);

    expect(mockSpawn).not.toHaveBeenCalled();
  });

  test('should reject immediately if the signal is already aborted', async () => {
    const memoizedProcess = process.memoize();
    const controller = new AbortController();
    controller.abort();

    await expect(memoizedProcess.run(controller.signal)).rejects.toThrow(
      'Signal already aborted',
    );
  });

  test('should not cache results of executions that encounter errors or are aborted', async () => {
    const memoizedProcess = process.memoize();
    const controller = new AbortController();

    (spawn as jest.Mock).mockImplementation(() => ({
      on: (event: string, callback: Function) => {
        if (event === 'error') callback(new Error('Process error'));
      },
      kill: jest.fn(),
      removeAllListeners: jest.fn(),
    }));

    await expect(memoizedProcess.run(controller.signal)).rejects.toThrow();
    (spawn as jest.Mock).mockClear();

    // Attempt to rerun with the same signal
    await expect(memoizedProcess.run(controller.signal)).rejects.toThrow();
    expect(spawn).toHaveBeenCalled();
  });

  test('should handle concurrent invocations with the same signal correctly', async () => {
    const memoizedProcess = process.memoize();
    const controller = new AbortController();

    let resolveFunction = () => {};

    (spawn as jest.Mock).mockImplementation(() => ({
      // # FIXME
      // There is mistake in this mock implementation, with this scenario only first callback from .on("e",callback) will be invoked
      // If I do process.on("close",cb1), process.on("close",cb2), process.on("close",cb3) this will not work, only cb1 will be called
      // BDW i'll try to solve this without modifying tests since that's a requirement
      on: (event: string, callback: Function) => {
        if (event === 'close') {
          resolveFunction = () => callback(0);
        }
      },
      kill: jest.fn(),
      removeAllListeners: jest.fn(),
    }));

    const firstCall = memoizedProcess.run(controller.signal);
    const secondCall = memoizedProcess.run(controller.signal);

    resolveFunction();

    await expect(firstCall).resolves.toBeUndefined();
    await expect(secondCall).resolves.toBeUndefined();
  });
});
