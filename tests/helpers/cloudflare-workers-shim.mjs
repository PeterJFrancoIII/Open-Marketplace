/** Test-only shim: export the env object supplied to worker.fetch. */
export const env = new Proxy(
  {},
  {
    get(_target, prop) {
      const current = globalThis.__OPEN_MARKETPLACE_TEST_ENV__;
      if (!current) return undefined;
      return current[prop];
    },
    has(_target, prop) {
      const current = globalThis.__OPEN_MARKETPLACE_TEST_ENV__;
      return Boolean(current && prop in current);
    },
    ownKeys() {
      const current = globalThis.__OPEN_MARKETPLACE_TEST_ENV__;
      return current ? Reflect.ownKeys(current) : [];
    },
    getOwnPropertyDescriptor(_target, prop) {
      const current = globalThis.__OPEN_MARKETPLACE_TEST_ENV__;
      if (!current || !(prop in current)) return undefined;
      return {
        configurable: true,
        enumerable: true,
        value: current[prop],
        writable: false,
      };
    },
  },
);

const cloudflareWorkers = { env };
export default cloudflareWorkers;
