export class SpawnProcessException extends Error {}

export class SpawnProcessCloseException extends SpawnProcessException {
  constructor(
    readonly code?: number | null,
    readonly signal?: NodeJS.Signals | null,
  ) {
    super(
      `Process closed: ${(code && `code: ${code}`) || ''} ${
        (signal && `signal: ${signal}`) || ''
      }`,
    );
  }
}

export class SpawnProcessFailureException extends SpawnProcessException {
  constructor(err?: Error) {
    super(err?.message);
    if (err?.stack) this.stack = err?.stack;
    if (err?.name) this.name = err?.name;
  }
}

export class AbortException extends SpawnProcessException {
  constructor(message?: string) {
    super(message || 'Process was terminated by AbortController');
  }
}

export class AlreadyAbortedException extends AbortException {
  constructor() {
    super('Signal already aborted');
  }
}
