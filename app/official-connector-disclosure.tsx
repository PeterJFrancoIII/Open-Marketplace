import {
  officialConnectorLine,
  publicConnectorCatalog,
  type OfficialConnectorDisplay,
} from "../lib/official-connector-facts";
import type { SocialConnectorId } from "../lib/social-connectors";
import type { SocialProof } from "../lib/types";

const CONNECTOR_MARK: Record<SocialConnectorId, string> = {
  facebook: "fb",
  tiktok: "tt",
  instagram: "ig",
  twitter: "x",
  linkedin: "in",
  reddit: "rd",
  discord: "dc",
};

export function OfficialConnectorDisclosure({
  official,
  emptyLabel,
  rowKey,
}: {
  official: OfficialConnectorDisplay;
  emptyLabel?: string;
  rowKey?: string;
}) {
  return (
    <div className="official-connector-disclosure">
      {official.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={official.imageUrl} alt="" width={48} height={48} />
      ) : null}
      {official.rows.length ? (
        <dl className="portal-connector-facts">
          {official.rows.map((row) => (
            <div key={`${rowKey ?? "official"}-${row.label}`}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : emptyLabel ? (
        <p>{emptyLabel}</p>
      ) : null}
      {official.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="portal-connector-banner"
          src={official.bannerUrl}
          alt=""
          width={160}
          height={48}
        />
      ) : null}
    </div>
  );
}

export function OfficialConnectorChips({
  accounts,
  heading,
  showMissing = true,
}: {
  accounts: SocialProof[];
  heading?: string;
  showMissing?: boolean;
}) {
  const catalog = publicConnectorCatalog(accounts);
  const connected = catalog.filter((row) => row.connected);
  const missing = catalog.filter((row) => !row.connected);

  return (
    <div className="social-facts official-connector-chips">
      {heading ? (
        <strong className="official-connector-chips-title">{heading}</strong>
      ) : null}
      {connected.length ? (
        connected.map((row) => {
          const line = officialConnectorLine(row.official);
          const inner = (
            <>
              <span className="proof-mark">{CONNECTOR_MARK[row.id]}</span>
              <span className="social-fact-copy">
                <strong>{row.official.headline || row.label}</strong>
                <small>
                  Connected with {row.label}
                  {line ? ` · ${line}` : ""}
                </small>
              </span>
              <span className="link-health">Connected</span>
            </>
          );
          if (!row.profileUrl) {
            return (
              <span
                className="social-fact social-connected status-active"
                title={line || `${row.label} connected`}
                key={row.id}
              >
                {inner}
              </span>
            );
          }
          return (
            <a
              className="social-fact social-connected status-active"
              href={row.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={line || `Open ${row.label} profile`}
              aria-label={`Open ${row.label} profile`}
              key={row.id}
            >
              {inner}
            </a>
          );
        })
      ) : (
        <span className="no-social">No social account supplied</span>
      )}
      {showMissing && missing.length ? (
        <span className="no-social">
          Not connected: {missing.map((row) => row.label).join(", ")}
        </span>
      ) : null}
    </div>
  );
}
