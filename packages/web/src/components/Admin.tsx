import "./Access.css";
import { useQuery } from "@tanstack/react-query";
import { errorMessage as errorMessageFrom } from "../lib/api.ts";
import { agencyQueries, useRemoveAgency } from "../lib/queries.ts";

export default function Admin({
  online,
  email,
  busy,
  error,
  onEmailInput,
  onInvite,
}: {
  online: boolean | null;
  email: string;
  busy: boolean;
  error: string | null;
  onEmailInput: (email: string) => void;
  onInvite: () => void;
}) {
  const {
    data: agencies = [],
    isFetching,
    refetch,
  } = useQuery({
    ...agencyQueries.list(),
    enabled: online === true,
  });
  const removeAgency = useRemoveAgency();
  const errorMessage = error ? errorMessageFrom(error) : null;

  return (
    <div data-component="admin">
      <div className="section-header">
        <div>
          <p className="overline">Admin</p>
          <h2>Agencies</h2>
        </div>
        <button className="light-button" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Loading…" : "Refresh"}
        </button>
      </div>

      <section className="access-card">
        <h3>Invite an agency</h3>
        <p className="domain-hint">
          Agencies manage client sites and can invite their clients to edit and publish.
        </p>
        <div className="invite-row">
          <input
            type="email"
            placeholder="agency@studio.co"
            value={email}
            onChange={(e) => onEmailInput(e.target.value)}
          />
          <button
            className="dark-button"
            onClick={onInvite}
            disabled={busy || email.trim().length === 0}
          >
            {busy ? "Inviting…" : "Invite"}
          </button>
        </div>
        {errorMessage && <p className="domain-error">{errorMessage}</p>}
      </section>

      <section className="access-card">
        <h3>Agencies</h3>
        {agencies.length === 0 && !isFetching ? (
          <p className="domain-hint">No agencies yet — invite one above.</p>
        ) : (
          <div className="member-list">
            {agencies.map((agency) => (
              <div className="member-row" key={agency.email}>
                <div className="member-identity">
                  <strong>{agency.email}</strong>
                  {agency.pending && <span className="status-pill">Invited</span>}
                </div>
                <button
                  className="section-btn remove"
                  onClick={() => removeAgency.mutate(agency.email)}
                  disabled={removeAgency.isPending}
                  aria-label={`Remove ${agency.email}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
