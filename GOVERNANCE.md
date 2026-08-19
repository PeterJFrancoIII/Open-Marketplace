# Open Marketplace Governance

This is a governing document. It ranks immediately after `Master_Descriptor.md`.

## The community builds the product

Open Marketplace is developed in a limited, controlled, crowdsourced way.

The people who use the program are expected to test every surface of it:
every page, subpage, button, field, and section. Each of those surfaces
carries a single `!` control. Clicking `!` opens a report. The report is
either a **Bug** or a **Feature Request**. The selected surface’s link is
included automatically so reviewers can return to the exact control.

Reports are stored in the marketplace database as `community_reports`.
They are not informal chat and they are not GitHub issues. They are
product evidence.

## Daily compilation and human review

At the end of each day:

1. Agents compile the queued community reports for that UTC day.
2. The digest groups bugs and feature requests by surface link.
3. A human reviewer reads the digest and decides what to adapt.
4. Agents implement only the adaptations the human authorizes.

This loop is how users help build the application. It does not replace
human authority. The human owner remains rank 1. Codex remains the
architect. Cursor remains an implementation subagent.

Use `/admin/community` or `GET /api/community-reports?view=digest` for
the day’s digest. `scripts/compile-community-reports.mjs` can compile a
digest from exported records.

## Cybersecurity is never community-owned

Cybersecurity and access-control surfaces belong only to administrators.

The community may report ordinary product bugs on any visible page,
including that a login button is hard to use. The community may not
request, vote on, or otherwise steer:

- authentication or authorization design;
- administrator membership or privileges;
- encryption, session, secret, or token handling;
- exploit, bypass, or “make security user-controlled” requests;
- weakening HTTPS, CSP, CSRF, SSRF, or related protections.

Those reports are filtered out of the community queue. They may be
retained for administrators. They must never be compiled into the daily
crowdsource digest and must never be treated as work the community is
entitled to have built.

No agent may implement a community request that changes a security
control surface unless the human owner and an administrator explicitly
authorize that exact change in a separate task.

## Live and development versions

Keep exactly two public versions. The public live link must stay
constant. `https://open-marketplace-demo.pages.dev` is retired as a
public live URL: that slot’s production database is empty, so accounts
and listings fail there.

- **Live** is the owner-confirmed account-management program. Until a
  purchased custom domain is attached, the only public live URL is
  `https://feature-account-management-p.open-marketplace-demo.pages.dev/`
  on `feature/account-management-portal`. Do not send users to
  `open-marketplace-demo.pages.dev`.
- **Development** is `feature/community-surface-reports` at
  `https://feature-community-surface-re.open-marketplace-demo.pages.dev/`.
  New experiments stay on this track until the owner promotes them.

The Cloudflare Pages project remains the host. The public name must be
a short custom domain the owner buys. Do not recreate additional
product forks. Security-control work still belongs only to
administrators on both versions.

## Authority reminder

1. Human owner: final product, acceptance, merge, and production.
2. Codex: architecture, contracts, review, and administration.
3. Cursor and other implementers: assigned work only, then evidence.

Crowdsourced reports inform the human reviewer. They do not outrank
this document, the master descriptor, or the security invariants.
