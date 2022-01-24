// A note about enums:
// Typescript documentation recommends using "as const" over "enum"
// https://www.typescriptlang.org/docs/handbook/enums.html#objects-vs-enums

let _enumValue = 0;
export function enumVal(value?: number): number {
  if (value !== undefined) {
    _enumValue = value;
  }
  return _enumValue++;
}

// Parameters for exponentialBackOff
export type ExponentialBackOffParams = {
  retries: number;
  delay: number;
  toTry: () => Promise<unknown>;
  success?: (result: unknown) => void;
  fail?: (error: unknown) => void;
};

// This function keeps calling "toTry" until promise resolves or has
// retried "retries" number of times. First retry has a delay of "delay" seconds.
// "success" is called upon success.
// See auto-reconnect code from Google:
// https://googlechrome.github.io/samples/web-bluetooth/automatic-reconnect-async-await.html
export async function exponentialBackOff({
  retries,
  delay,
  toTry,
  success = undefined,
  fail = undefined,
}: ExponentialBackOffParams): Promise<void> {
  try {
    const result = await toTry();
    if (success) {
      success(result);
    }
  } catch (error) {
    if (retries !== 0) {
      //console.log(`Retrying in ${delay}s... (${retries} tries left)`);
      const delay_ = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      await delay_(delay * 1000);
      await exponentialBackOff({
        retries: retries - 1,
        delay: delay * 2,
        toTry,
        success,
        fail,
      });
    } else if (fail) {
      //console.log(`Got error ${error}`);
      fail(error);
    }
  }
}

// https://spin.atomicobject.com/2018/09/10/javascript-concurrency/
export class Mutex {
  private mutex = Promise.resolve();

  // Lock the mutex and return the function to unlock it
  lock(): Promise<() => void> {
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    let executor = (_resolve: () => void) => {};

    // Update the mutex (note: the fulfillment handler will be called asynchronously)
    this.mutex = this.mutex.then(() => {
      // This is called asynchronously, once the promise below has run
      // so "executor" has already been updated to the resolution handler
      // of the promised returned by lock()
      // This promise will resolve only once the function returned by the lock()
      // promise is run
      return new Promise(executor);
    });

    // The returned promise set the above mutex promise executor to it's resolution function,
    // meaning that the result of this promise will be the mutex promise's own resolution function
    return new Promise((resolve) => {
      executor = resolve;
    });
  }

  // Call the given function or promise while holding the mutex' lock
  async dispatch<T>(fn: (() => T) | (() => PromiseLike<T>)): Promise<T> {
    const unlock = await this.lock();
    try {
      return await Promise.resolve(fn());
    } finally {
      unlock();
    }
  }
}
