/**
 * Configure Cloudflare Pages *preview* bindings only.
 * Never writes production URL, production D1, or secrets to Git.
 */
import { pathToFileURL } from "node:url";

const PROJECT = "open-marketplace-demo";
const PRODUCTION_D1_DATABASE_ID = "6ceb8dfc-4a92-4d4d-832f-ff1a54847326";
const DEFAULT_PREVIEW_D1_DATABASE_ID = "8ddff0ae-f810-4d71-955e-4aab40a00e27";

function assignPreviewPair(previewEnvVars, idName, secretName, idValue, secretValue) {
  const id = idValue?.trim();
  const secret = secretValue?.trim();
  if (!id || !secret) return;
  previewEnvVars[idName] = { type: "plain_text", value: id };
  previewEnvVars[secretName] = { type: "secret_text", value: secret };
}

export function buildPagesPreviewDeploymentConfigs({
  previewD1DatabaseId,
  authSecret,
  adminEmails,
  facebookClientId,
  facebookClientSecret,
  instagramClientId,
  instagramClientSecret,
  tiktokClientKey,
  tiktokClientSecret,
  twitterClientId,
  twitterClientSecret,
  linkedinClientId,
  linkedinClientSecret,
  redditClientId,
  redditClientSecret,
  discordClientId,
  discordClientSecret,
  paypalClientId,
  paypalClientSecret,
  paypalEnv,
  parcelMonkeyUserId,
  parcelMonkeyApiToken,
}) {
  const previewEnvVars = {
    RELEASE_MODE: { type: "plain_text", value: "demo" },
    BETTER_AUTH_SECRET: { type: "secret_text", value: authSecret },
    MARKETPLACE_ADMIN_EMAILS: {
      type: "plain_text",
      value: adminEmails,
    },
  };
  assignPreviewPair(
    previewEnvVars,
    "FACEBOOK_CLIENT_ID",
    "FACEBOOK_CLIENT_SECRET",
    facebookClientId,
    facebookClientSecret,
  );
  assignPreviewPair(
    previewEnvVars,
    "INSTAGRAM_CLIENT_ID",
    "INSTAGRAM_CLIENT_SECRET",
    instagramClientId,
    instagramClientSecret,
  );
  assignPreviewPair(
    previewEnvVars,
    "TIKTOK_CLIENT_KEY",
    "TIKTOK_CLIENT_SECRET",
    tiktokClientKey,
    tiktokClientSecret,
  );
  assignPreviewPair(
    previewEnvVars,
    "TWITTER_CLIENT_ID",
    "TWITTER_CLIENT_SECRET",
    twitterClientId,
    twitterClientSecret,
  );
  assignPreviewPair(
    previewEnvVars,
    "LINKEDIN_CLIENT_ID",
    "LINKEDIN_CLIENT_SECRET",
    linkedinClientId,
    linkedinClientSecret,
  );
  assignPreviewPair(
    previewEnvVars,
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
    redditClientId,
    redditClientSecret,
  );
  assignPreviewPair(
    previewEnvVars,
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    discordClientId,
    discordClientSecret,
  );
  const paypalId = paypalClientId?.trim();
  const paypalSecret = paypalClientSecret?.trim();
  if (paypalId && paypalSecret) {
    previewEnvVars.PAYPAL_CLIENT_ID = {
      type: "plain_text",
      value: paypalId,
    };
    previewEnvVars.PAYPAL_CLIENT_SECRET = {
      type: "secret_text",
      value: paypalSecret,
    };
    previewEnvVars.PAYPAL_ENV = {
      type: "plain_text",
      value: paypalEnv?.trim() === "live" ? "live" : "sandbox",
    };
  }
  const parcelUser = parcelMonkeyUserId?.trim();
  const parcelToken = parcelMonkeyApiToken?.trim();
  if (parcelUser && parcelToken) {
    previewEnvVars.PARCEL_MONKEY_USER_ID = {
      type: "plain_text",
      value: parcelUser,
    };
    previewEnvVars.PARCEL_MONKEY_API_TOKEN = {
      type: "secret_text",
      value: parcelToken,
    };
  }

  return {
    preview: {
      env_vars: previewEnvVars,
      d1_databases: {
        DB: { id: previewD1DatabaseId },
      },
      fail_open: true,
      always_use_latest_compatibility_date: false,
      compatibility_date: "2026-05-15",
      compatibility_flags: ["nodejs_compat"],
      build_image_major_version: 3,
      usage_model: "standard",
    },
    production: {
      env_vars: {
        RELEASE_MODE: { type: "plain_text", value: "demo" },
      },
      d1_databases: {
        DB: { id: PRODUCTION_D1_DATABASE_ID },
      },
      fail_open: true,
      always_use_latest_compatibility_date: false,
      compatibility_date: "2026-05-15",
      compatibility_flags: ["nodejs_compat"],
      build_image_major_version: 3,
      usage_model: "standard",
    },
  };
}

async function configurePagesPreview() {
  const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
  const PREVIEW_D1_DATABASE_ID =
    process.env.PREVIEW_D1_DATABASE_ID || DEFAULT_PREVIEW_D1_DATABASE_ID;
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

  const deployment_configs = buildPagesPreviewDeploymentConfigs({
    previewD1DatabaseId: PREVIEW_D1_DATABASE_ID,
    authSecret: AUTH_SECRET,
    adminEmails: ADMIN_EMAILS,
    facebookClientId: process.env.FACEBOOK_CLIENT_ID,
    facebookClientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    instagramClientId: process.env.INSTAGRAM_CLIENT_ID,
    instagramClientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    tiktokClientKey: process.env.TIKTOK_CLIENT_KEY,
    tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET,
    twitterClientId: process.env.TWITTER_CLIENT_ID,
    twitterClientSecret: process.env.TWITTER_CLIENT_SECRET,
    linkedinClientId: process.env.LINKEDIN_CLIENT_ID,
    linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redditClientId: process.env.REDDIT_CLIENT_ID,
    redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
    discordClientId: process.env.DISCORD_CLIENT_ID,
    discordClientSecret: process.env.DISCORD_CLIENT_SECRET,
    paypalClientId: process.env.PAYPAL_CLIENT_ID,
    paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET,
    paypalEnv: process.env.PAYPAL_ENV,
    parcelMonkeyUserId: process.env.PARCEL_MONKEY_USER_ID,
    parcelMonkeyApiToken: process.env.PARCEL_MONKEY_API_TOKEN,
  });

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ deployment_configs }),
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
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  await configurePagesPreview();
}
