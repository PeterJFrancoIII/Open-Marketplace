"use client";

import { useId, useState } from "react";
import type { TrustCardVariant, TrustCardViewModel } from "../lib/trust/trust-card-model";

type Props = {
  model: TrustCardViewModel;
  variant?: TrustCardVariant;
  isOwner?: boolean;
  onFixSocial?: () => void;
  className?: string;
};

function providerTitle(provider: string): string {
  return provider.slice(0, 1).toUpperCase() + provider.slice(1);
}

export function TrustCard({
  model,
  variant = "compact",
  isOwner = false,
  onFixSocial,
  className = "",
}: Props) {
  const disclosureId = useId();
  const [open, setOpen] = useState(false);
  const isFull = variant === "full" || variant === "moderator";

  return (
    <section
      className={`trust-card trust-card-${variant} ${className}`.trim()}
      aria-label={`Trust evidence for ${model.displayName}`}
    >
      <header className="trust-card-head">
        <div>
          <p className="trust-card-eyebrow">{model.memberSinceLabel}</p>
          <p className="trust-card-experience">
            <span className={`trust-pill standing-${model.standing}`}>
              {model.experienceLabel} seller
            </span>
            {model.assuranceLabels.map((label) => (
              <span className="trust-pill assurance" key={label}>
                {label}
              </span>
            ))}
          </p>
        </div>
        {model.actionRequired && (
          <span className="trust-pill danger" role="status">
            Social action required
          </span>
        )}
      </header>

      <div className="trust-card-metrics" aria-label="Separate buyer and seller reputation">
        <div>
          <span className="trust-metric-label">Seller</span>
          <strong>{model.seller.label}</strong>
        </div>
        <div>
          <span className="trust-metric-label">Buyer</span>
          <strong>{model.buyer.label}</strong>
        </div>
      </div>

      {isFull && (
        <div className="trust-card-windows" aria-label="Reputation windows">
          <p>
            Lifetime seller reviews: {model.seller.ratingCount}
            {model.seller.displayMean != null ? ` · mean ${model.seller.displayMean.toFixed(1)}` : ""}
          </p>
          <p>
            Recent 12 months: {model.seller.recent12MonthCount ?? 0}
            {model.seller.recent12MonthMean != null
              ? ` · mean ${model.seller.recent12MonthMean.toFixed(1)}`
              : " · not enough reviews for a precise mean"}
          </p>
        </div>
      )}

      <div className="trust-card-social" aria-label="Linked social profiles">
        {model.social.length ? (
          model.social.map((chip) => (
            <a
              key={chip.id}
              className={`trust-social-chip status-${chip.status}`}
              href={chip.url}
              target="_blank"
              rel="noreferrer"
              title={chip.healthMessage}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <strong>{providerTitle(chip.provider)}</strong>
              <span>
                {chip.statusLabel}
                {chip.handle ? ` · @${chip.handle}` : ""}
              </span>
              <small>
                {chip.sourceLabel}
                {chip.connectionCount != null
                  ? ` · ${chip.connectionCount.toLocaleString()} ${chip.connectionLabel ?? "connections"}`
                  : ""}
                {chip.accountCreatedAt ? ` · account age ${chip.sourceLabel}` : ""}
                {chip.lastCheckedAt
                  ? ` · checked ${new Date(chip.lastCheckedAt).toLocaleDateString()}`
                  : ""}
              </small>
            </a>
          ))
        ) : (
          <span className="trust-social-empty">No social account supplied</span>
        )}
      </div>

      {isOwner && model.actionRequired && (
        <button
          type="button"
          className="trust-fix-button"
          onClick={(event) => {
            event.stopPropagation();
            onFixSocial?.();
          }}
        >
          Fix social link
        </button>
      )}

      <div className="trust-card-disclosure">
        <button
          type="button"
          className="trust-why-button"
          aria-expanded={open}
          aria-controls={disclosureId}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
        >
          Why this is shown
        </button>
        {open && (
          <ul id={disclosureId} className="trust-disclosure-list">
            {model.disclosures.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>

      {variant === "moderator" && (
        <p className="trust-moderator-note">
          Moderator view: standing `{model.standing}` · profile `{model.profileId}`
        </p>
      )}
    </section>
  );
}
