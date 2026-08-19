import "./Leads.css";
import { useQuery } from "@tanstack/react-query";
import type { Site } from "../types.ts";
import { errorMessage as errorMessageFrom } from "../lib/api.ts";
import { leadQueries, useDeleteLead } from "../lib/queries.ts";
import { UsersIcon, ArrowRightIcon } from "@phosphor-icons/react";

export default function Leads({
  site,
  online,
  onEdit,
}: {
  site: Site;
  online: boolean | null;
  onEdit: () => void;
}) {
  const siteId = online ? site.id : undefined;
  const {
    data: leads = [],
    error,
    isFetching,
    refetch,
  } = useQuery({
    ...leadQueries.list(siteId ?? ""),
    enabled: !!siteId,
  });
  const deleteLead = useDeleteLead();
  const errorMessage = deleteLead.error
    ? errorMessageFrom(deleteLead.error)
    : error
      ? errorMessageFrom(error)
      : null;

  if (!site.id || !online) {
    return (
      <div className="empty-page">
        <div className="empty-icon">
          <UsersIcon size={28} />
        </div>
        <h2>Your leads, in one place</h2>
        <p>When visitors reach out through your site, their inquiries will appear here.</p>
        <button className="dark-button" onClick={onEdit}>
          Customize your site <ArrowRightIcon size={16} />
        </button>
      </div>
    );
  }

  return (
    <div data-component="leads">
      <div className="section-header">
        <div>
          <p className="overline">Leads</p>
          <h2>{site.business.name} — new inquiries</h2>
        </div>
        <button className="light-button" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Loading…" : "Refresh"}
        </button>
      </div>

      {errorMessage && (
        <div className="conn-banner" data-kind="error">
          <span>{errorMessage}</span>
        </div>
      )}

      {leads.length === 0 && !isFetching ? (
        <div className="empty-page empty-leads">
          <div className="empty-icon">
            <UsersIcon size={28} />
          </div>
          <h2>No leads yet</h2>
          <p>Add a contact form to your site — messages from visitors will show up here.</p>
          <button className="dark-button" onClick={onEdit}>
            Open editor <ArrowRightIcon size={16} />
          </button>
        </div>
      ) : (
        <div className="lead-list">
          {leads.map((lead) => (
            <div className="lead-card" key={lead.id}>
              <div className="lead-body">
                <div className="lead-head">
                  <strong>{lead.name}</strong>
                  <a href={`mailto:${lead.email}`}>{lead.email}</a>
                </div>
                {lead.message && <p>{lead.message}</p>}
                <small>{new Date(lead.createdAt).toLocaleString()}</small>
              </div>
              <button
                className="section-btn remove"
                onClick={() => deleteLead.mutate({ siteId: site.id, leadId: lead.id })}
                aria-label="Delete lead"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
