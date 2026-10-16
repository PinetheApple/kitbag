export type Work<T> = () => Promise<T>;

export interface Transactor {
  serial: <T>(work: Work<T>) => Promise<T>;
  transaction: <T>(work: Work<T>) => Promise<T>;
}

export function createTransactor(
  execute: (statement: string) => unknown,
): Transactor {
  // A transaction is per-connection: any statement issued while another
  // caller's BEGIN is open joins it, so every repository call queues here.
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: Work<T>): Promise<T> => {
    const result = tail.then(work);
    tail = result.catch(() => undefined);
    return result;
  };
  const atomic = async <T>(work: Work<T>): Promise<T> => {
    await execute('BEGIN');
    try {
      const result = await work();
      await execute('COMMIT');
      return result;
    } catch (error) {
      await execute('ROLLBACK');
      throw error;
    }
  };
  return {
    serial,
    transaction: (work) => serial(() => atomic(work)),
  };
}
