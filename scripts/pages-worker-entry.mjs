import appHandler from "../dist/server/index.js";

export function createPagesHandler(handler) {
  return {
    async fetch(request, env, context) {
      if (
        (request.method === "GET" || request.method === "HEAD") &&
        env?.ASSETS
      ) {
        const assetResponse = await env.ASSETS.fetch(request);

        if (assetResponse.status !== 404) {
          return assetResponse;
        }
      }

      return handler.fetch(request, env, context);
    },
  };
}

export default createPagesHandler(appHandler);
