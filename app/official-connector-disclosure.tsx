import {
  publicConnectorCatalog,
  type OfficialConnectorDisplay,
} from "../lib/official-connector-facts";
import type { SocialProof } from "../lib/types";

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

export function OfficialConnectorCatalog({
  accounts,
  heading,
  emptyConnectedLabel,
}: {
  accounts: SocialProof[];
  heading?: string;
  emptyConnectedLabel?: string;
}) {
  return (
    <div className="official-connector-catalog">
      {heading ? <strong className="official-connector-catalog-title">{heading}</strong> : null}
      {publicConnectorCatalog(accounts).map((row) => (
        <div
          className={`official-connector-catalog-row${row.connected ? " is-connected" : ""}`}
          key={row.id}
        >
          <div className="official-connector-catalog-head">
            <strong>{row.label}</strong>
            <span>{row.connected ? "Connected" : "Not connected"}</span>
          </div>
          {row.connected ? (
            <>
              <OfficialConnectorDisclosure
                official={row.official}
                emptyLabel={emptyConnectedLabel ?? `${row.label} account connected.`}
                rowKey={row.id}
              />
              {row.profileUrl ? (
                <a
                  className="button button-ghost official-connector-profile-link"
                  href={row.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {row.id === "facebook"
                    ? "Open Facebook profile"
                    : `Open ${row.label} profile`}
                </a>
              ) : null}
            </>
          ) : (
            <p className="form-note">
              This person has not connected {row.label}.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
