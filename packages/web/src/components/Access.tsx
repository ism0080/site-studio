import { useQuery } from "@tanstack/react-query";
import type { Member, Site } from "../types.ts";
import type { AccessToggles } from "../lib/appMachine.ts";
import { errorMessage as errorMessageFrom } from "../lib/api.ts";
import { memberQueries, useRemoveMember, useUpdateMember } from "../lib/queries.ts";

const TOGGLE_LABELS: ReadonlyArray<[keyof AccessToggles, string]> = [
  ["canEdit", "Edit"],
  ["canPublish", "Publish"],
  ["canLeads", "Leads"],
];

function MemberRow({ siteId, member }: { siteId: string; member: Member }) {
  const updateMember = useUpdateMember();
  const removeMember = useRemoveMember();
  const busy = updateMember.isPending || removeMember.isPending;

  return (
    <div className="member-row">
      <div className="member-identity">
        <strong>{member.email}</strong>
        {member.pending && <span className="status-pill">Invited</span>}
      </div>
      <div className="member-toggles">
        {TOGGLE_LABELS.map(([key, label]) => (
          <label className="toggle" key={key}>
            <input
              type="checkbox"
              checked={member[key]}
              disabled={busy}
              onChange={() =>
                updateMember.mutate({
                  siteId,
                  email: member.email,
                  input: {
                    email: member.email,
                    canEdit: key === "canEdit" ? !member.canEdit : member.canEdit,
                    canPublish: key === "canPublish" ? !member.canPublish : member.canPublish,
                    canLeads: key === "canLeads" ? !member.canLeads : member.canLeads,
                  },
                })
              }
            />
            {label}
          </label>
        ))}
      </div>
      <button
        className="section-btn remove"
        onClick={() => removeMember.mutate({ siteId, email: member.email })}
        disabled={busy}
        aria-label={`Remove ${member.email}`}
      >
        ×
      </button>
    </div>
  );
}

export default function Access({
  site,
  online,
  email,
  toggles,
  busy,
  error,
  onEmailInput,
  onToggle,
  onInvite,
}: {
  site: Site;
  online: boolean | null;
  email: string;
  toggles: AccessToggles;
  busy: boolean;
  error: string | null;
  onEmailInput: (email: string) => void;
  onToggle: (key: keyof AccessToggles) => void;
  onInvite: () => void;
}) {
  const siteId = online ? site.id : undefined;
  const {
    data: members = [],
    isFetching,
    refetch,
  } = useQuery({
    ...memberQueries.list(siteId ?? ""),
    enabled: !!siteId,
  });
  const errorMessage = error ? errorMessageFrom(error) : null;

  return (
    <div className="access-page">
      <div className="section-header">
        <div>
          <p className="overline">Access</p>
          <h2>{site.business.name} — who can edit</h2>
        </div>
        <button className="light-button" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Loading…" : "Refresh"}
        </button>
      </div>

      <section className="access-card">
        <h3>Invite a client</h3>
        <p className="domain-hint">
          Add their email and choose what they can do on their own site.
        </p>
        <div className="invite-row">
          <input
            type="email"
            placeholder="client@example.com"
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
        <div className="member-toggles">
          {TOGGLE_LABELS.map(([key, label]) => (
            <label className="toggle" key={key}>
              <input
                type="checkbox"
                checked={toggles[key]}
                disabled={busy}
                onChange={() => onToggle(key)}
              />
              {label}
            </label>
          ))}
        </div>
        {errorMessage && <p className="domain-error">{errorMessage}</p>}
      </section>

      <section className="access-card">
        <h3>Clients with access</h3>
        {members.length === 0 && !isFetching ? (
          <p className="domain-hint">No clients yet — invite one above.</p>
        ) : (
          <div className="member-list">
            {members.map((member) => (
              <MemberRow key={member.email} siteId={site.id} member={member} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
