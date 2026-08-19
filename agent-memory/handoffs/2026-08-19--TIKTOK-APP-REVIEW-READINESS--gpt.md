---
schema_version: "1.0"
kind: "planning_handoff"
task_id: "TBD"
agent_id: "gpt"
agent_role: "architecture_and_review_agent"
status: "ready_for_gpt"
created_at: "2026-08-19T21:16:00Z"
repository: "PeterJFrancoIII/Open-Marketplace"
source_program_branch: "reconcile/social-connect-catalog"
shared_memory_branch: "main"
review_source_policy: "Use reconcile/social-connect-catalog as the application source. main is shared-memory-only for this handoff; do not use main application code as implementation evidence."
implementation_authorized: false
tiktok_submission_authorized: false
production_deploy_authorized: false
owner_manual_result: "not_run"
contains_secrets_or_private_data: false
---

# GPT Handoff — Open Marketplace TikTok App Review Readiness

## Purpose

Framework Open Marketplace for a future first TikTok for Developers app-review submission. This handoff defines the technical, policy, legal-page, sandbox-demo, and reviewer-copy requirements needed before the owner submits the TikTok application.

This is a planning/review handoff only. It does **not** authorize implementation, production deployment, TikTok submission, or owner acceptance.

## Program source boundary

Review and work only from the current Open Marketplace application program identified by the owner as:

- Application branch: `reconcile/social-connect-catalog`
- Review preview: `https://reconcile-social-connect-cat.open-marketplace-demo.pages.dev/`

`main` is used here only as the canonical shared-memory workspace. Do not use `main` application code as implementation evidence or as the app to be reviewed.

Do not substitute another branch, old ZIP, old preview, PR, or production deployment for this application source.

## Objective

Make Open Marketplace technically and policy-ready for its first TikTok for Developers application review.

The TikTok integration is an **optional connection to an existing Open Marketplace account**. It must not become social sign-in for Open Marketplace, must not alter the user's core marketplace identity, and must not introduce posting, video access, messaging access, follower analytics, or Social Credit scoring.

Do **not** submit the TikTok application merely because this task is implemented. Submission remains an owner action after technical review, demo verification, and owner approval.

## TikTok product and scope

Implement only when separately authorized:

- **Platform:** Web
- **Product:** TikTok Login Kit / OAuth authorization
- **Scope:** `user.info.basic` only

Do not request:

- `user.info.profile`
- `user.info.stats`
- `video.list`
- Content Posting API
- Share Kit
- messaging access
- follower/following statistics
- any other TikTok scope unless separately authorized

Rationale: first review should request the smallest scope necessary to establish a voluntary provider-authoritative account link. Additional TikTok products/scopes increase review surface and must be justified and demonstrated.

Official references:

- App Review Guidelines: https://developers.tiktok.com/doc/app-review-guidelines
- Login Kit overview: https://developers.tiktok.com/doc/login-kit-overview
- User info API: https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info

## Required account-linking behavior

The user must first authenticate to Open Marketplace using the existing Open Marketplace authentication system.

Account Settings then provides:

**TikTok → Connect TikTok**

Expected flow:

`Open Marketplace account → Account Settings → Connect TikTok → TikTok authorization → callback → provider validation → Connected`

A successful connection must correlate the provider authorization to the currently authenticated Open Marketplace user.

Use the TikTok app-scoped `open_id` as the durable provider identity when returned by the approved TikTok flow.

TikTok access token, refresh token, client secret, raw provider response, and provider avatar URL must not become public marketplace data.

Do not copy TikTok information into the Open Marketplace user's email, core display name, image, or other core profile fields.

Do not enable public listing social proof as part of this task.

Do not alter Social Credit.

## Security requirements

Web authorization must use the current TikTok OAuth v2 authorization flow with an exact HTTPS redirect URI.

Implement and verify:

- cryptographically strong `state`
- state validation on callback
- server-side authorization-code exchange
- server-side client secret
- server-side access/refresh tokens
- provider/app identity validation
- fail-closed behavior
- disconnect/revocation behavior
- no OAuth token exposure to browser/public registry/logs

## TikTok disconnected/stale state

Follow the provider-authoritative principle already adopted by Open Marketplace.

A stored database row alone must never be enough to claim **Connected**.

If current TikTok provider authorization cannot be validated, fail closed.

A minimal stale state may display **Needs reconnect** with:

- Disconnect
- Connect TikTok

Do not display stale provider information as current proof.

## Social catalog

Preserve exactly these seven rows:

- Facebook
- Instagram
- TikTok
- X
- LinkedIn
- Reddit
- Discord

TikTok may move from unavailable to operational only after its connector is actually implemented and reviewed.

Do not implement the other unavailable connectors in this task.

# Reviewer-facing legal readiness

TikTok app review requires a valid official Terms of Service URL and Privacy Policy URL that resolve publicly on the submitted website. The legal pages and public website must accurately describe the functioning app and requested TikTok integration.

## Create `/terms`

Produce an actual public Open Marketplace Terms of Service page covering at minimum:

- service description
- user accounts
- marketplace listings
- user responsibility for listings and transactions
- prohibited behavior
- third-party providers and payment destinations
- social-account connections
- intellectual property
- service availability
- disclaimers
- limitation framework appropriate for the service
- account suspension/termination
- changes to terms
- governing/legal contact provisions appropriate to the operator

Do not write terms that falsely claim capabilities or legal arrangements that do not exist.

## Revise `/privacy`

Make it a general Open Marketplace Privacy Policy rather than a provider-preview-specific disclosure.

Include provider-specific sections where appropriate.

TikTok disclosure should explain:

- optional TikTok connection
- `user.info.basic`
- app-scoped provider identity
- basic provider profile information actually requested
- OAuth authorization
- server-side token handling
- purpose: connecting the user's TikTok identity to their existing marketplace account
- no social sign-in to Open Marketplace
- no TikTok posting
- no video reading
- no messaging
- no follower statistics
- disconnect/deletion behavior
- retention
- third-party/infrastructure processing
- no sale of TikTok provider data

Add **Terms** and **Privacy** links visibly to the public website.

# Reviewer-facing TikTok submission copy

## Description

TikTok field limit: 120 characters.

Use:

**A peer-to-peer marketplace where people buy and sell items and optionally connect social profiles.**

## Platform

Select:

**Web**

Do not select Desktop, Android, or iOS unless those platforms are actually implemented and review-ready.

## Terms of Service URL

Target:

`https://[FINAL-REVIEW-DOMAIN]/terms`

Do not enter this until it returns the real Terms page publicly.

## Privacy Policy URL

Target:

`https://[FINAL-REVIEW-DOMAIN]/privacy`

Do not submit a provider-preview-specific privacy page as the final TikTok privacy disclosure.

## App Review explanation

Keep within TikTok's 1,000-character field limit.

Use:

> Open Marketplace is a web-based peer-to-peer marketplace. TikTok integration is optional account linking for users who already have an Open Marketplace account. In Account Settings, the user selects Connect TikTok and authorizes TikTok Login Kit with user.info.basic. Our server exchanges the authorization code and uses the TikTok app-scoped open_id plus approved basic profile data only to confirm and display the linked TikTok identity. TikTok is not used to create or sign in to an Open Marketplace account. We do not post content, read videos or messages, or request follower statistics. Tokens remain server-side and are not published. Users can disconnect TikTok at any time, removing the linked authorization. The demo shows the complete sandbox flow on the submitted web domain: Open Marketplace sign-in → Connect TikTok → TikTok consent → Connected → Disconnect.

The submitted explanation must be revised if actual approved behavior or scope differs. Never claim functionality that is not present in the review build.

# Sandbox and demo-video requirement

For a first TikTok review, configure and use the TikTok Developer Portal Sandbox where required by the current App Review Guidelines.

The demo must be recorded from the same website domain supplied in the TikTok application.

Record one continuous MP4/MOV showing:

1. Browser address bar with submitted website domain.
2. Open Marketplace public marketplace.
3. Visible Terms and Privacy links.
4. Terms opens successfully.
5. Privacy opens successfully.
6. Sign into an existing Open Marketplace account.
7. Open Account Settings.
8. Show the seven social-network rows.
9. Select **Connect TikTok**.
10. Show actual TikTok authorization.
11. Show the requested scope/consent.
12. Approve.
13. Return to the same Open Marketplace domain.
14. Show **TikTok — Connected**.
15. Demonstrate only information permitted by the approved scope.
16. Show core Open Marketplace email/profile identity remained unchanged.
17. Click **Disconnect**.
18. Show TikTok returning to disconnected state.

Do not edit together a fake flow.

Do not demonstrate products/scopes that are not included in the submission.

All selected TikTok products and scopes must be clearly demonstrated. Remove unused products/scopes before review.

# Website/readiness gate

Do **not** submit while the reviewer-facing application is only an unfinished development/test surface or while required reviewer paths are missing.

The final Website URL used for review must resolve to the actual functioning Open Marketplace web app being demonstrated, not merely a landing page or dead login wall.

This handoff does not authorize an Open Marketplace production deployment.

Determine the appropriate public review deployment with the owner/Codex before submission.

The website shown in the demo, Web configuration, Privacy URL, Terms URL, and redirect URI must all correspond to the review configuration actually being submitted.

Complete any URL/domain ownership verification required by the current TikTok Developer Portal.

# Tests required before technical review can pass

Add automated coverage for:

- TikTok absent/unconnected state
- authorization initiation
- requested scope exactly `user.info.basic`
- callback `state` validation
- invalid state rejection
- server-side code exchange
- successful provider identity correlation
- wrong/mismatched provider response rejection
- tokens never serialized publicly
- TikTok does not overwrite Open Marketplace identity
- invalid/revoked authorization fails closed
- stale link remains disconnectable/reconnectable
- Disconnect removes TikTok authorization without deleting the Open Marketplace user
- no social login on `/login`
- other six catalog rows remain unchanged except TikTok becoming operational when authorized
- public listing social proof remains disabled
- Social Credit remains unchanged
- Terms route renders
- Privacy route contains TikTok disclosures
- public website visibly exposes Terms and Privacy links

# Acceptance criteria

The future TikTok-readiness implementation is review-ready only when:

- TikTok is actually operational on the authorized current program.
- Only `user.info.basic` is requested.
- Connect → authorization → Connected works in TikTok Sandbox/review configuration.
- Disconnect works.
- revoked/invalid authorization fails closed.
- no TikTok social sign-in exists.
- no provider data overwrites core Open Marketplace identity.
- no public listing social proof is introduced.
- no Social Credit change is introduced.
- `/terms` is public.
- `/privacy` is generalized and TikTok-aware.
- Terms/Privacy links are visible publicly.
- reviewer domain and TikTok configuration match.
- sandbox demo video demonstrates the complete flow.
- lint/tests/diff check pass.
- reviewer-facing copy matches actual behavior.

# Hard prohibitions

Do not:

- fabricate TikTok functionality for the video
- claim TikTok verification
- claim account age or follower counts without separately approved provider-authoritative data and scope
- request unnecessary scopes
- add TikTok login/signup to Open Marketplace
- expose OAuth credentials
- alter Social Credit
- publish social proof on listings
- add TikTok posting/video/message functionality
- implement other providers
- deploy production
- submit the TikTok application
- mark owner approval complete

# Required GPT return

Return a structured readiness report containing **Implemented / Not implemented / Blocked** for every acceptance criterion.

Include the exact:

- TikTok products selected
- scopes selected
- redirect URI
- public Website URL
- Terms URL
- Privacy URL
- sandbox configuration
- demo-video checklist status
- automated test evidence
- lint/diff-check evidence
- remaining rejection risks

Do not declare TikTok submission-ready until every required technical and reviewer-facing gate is actually satisfied.

# Current known readiness gaps at time of this handoff

At the time this planning handoff was authored, the previously reviewed current program had TikTok represented in the seven-network catalog but not yet operational, had a public `/privacy` page oriented around the Facebook non-production preview, and did not have a public application `/terms` route. These facts must be reverified against the authorized current application source before implementation begins.

# Next action

GPT should use this packet as the architecture/review framework. Before implementation is authorized, reverify current TikTok official documentation and the current application source, then produce a bounded implementation task. Do not implement, deploy production, or submit the TikTok application solely from this planning handoff.
