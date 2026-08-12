/**
 * Configure Cloudflare Pages *preview* bindings only.
 * Never writes production URL, production D1, or secrets to Git.
 */
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const PROJECT = "open-marketplace-demo";
const PREVIEW_D1_DATABASE_ID =
  process.env.PREVIEW_D1_DATABASE_ID ||
  "8ddff0ae-f810-4d71-955e-4aab40a00e27";
const AUTH_SECRET = process.env.BETTER_AUTH_SECRET?.trim();
const ADMIN_EMAILS = (
  process.env.MARKETPLACE_ADMIN_EMAILS || "preview-admin@example.com"
).trim();

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.");
  process.exit(1);
}
if (!AUTH_SECRET) {
  console.error("BETTER_AUTH_SECRET is required for preview configuration.");
  process.exit(1);
}

const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`,
  {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      deployment_configs: {
        preview: {
          env_vars: {
            RELEASE_MODE: { type: "plain_text", value: "demo" },
            BETTER_AUTH_SECRET: { type: "secret_text", value: AUTH_SECRET },
            MARKETPLACE_ADMIN_EMAILS: {
              type: "plain_text",
              value: ADMIN_EMAILS,
            },
          },
          d1_databases: {
            DB: { id: PREVIEW_D1_DATABASE_ID },
          },
          fail_open: true,
          always_use_latest_compatibility_date: false,
          compatibility_date: "2026-05-15",
          compatibility_flags: ["nodejs_compat"],
          build_image_major_version: 3,
          usage_model: "standard",
        },
      },
    }),
  },
);

const payload = await response.json();
if (!response.ok || payload.success === false) {
  console.error("Failed to configure Pages preview bindings.");
  console.error(JSON.stringify(payload.errors || payload, null, 2));
  process.exit(1);
}

const preview = payload.result?.deployment_configs?.preview || {};
const production = payload.result?.deployment_configs?.production || {};
console.log(
  JSON.stringify(
    {
      project: PROJECT,
      preview_d1: preview.d1_databases?.DB?.id || null,
      preview_env_keys: Object.keys(preview.env_vars || {}),
      production_d1: production.d1_databases?.DB?.id || null,
      production_env_keys: Object.keys(production.env_vars || {}),
    },
    null,
    2,
  ),
);
