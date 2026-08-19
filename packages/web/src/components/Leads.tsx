import "./Leads.css";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type { Site } from "../siteTypes.ts";
import { readableErrorMessage as readableErrorMessageFrom } from "../lib/formatting.ts";
import { leadQueries, useDeleteLead } from "../lib/apiQueries.ts";
import { UsersIcon, ArrowRightIcon } from "@phosphor-icons/react";

export default function Leads({ site, online }: { site: Site; online: boolean }) {
  const { siteId } = useParams({ from: "/_auth/sites/$siteId" });
  const siteIdForQuery = online ? site.id : undefined;
  const {
    data: leads = [],
    error,
    isFetching,
    refetch,
  } = useQuery({
    ...leadQueries.list(siteIdForQuery ?? ""),
    enabled: !!siteIdForQuery,
  });
  const deleteLead = useDeleteLead();
  const errorMessage = deleteLead.error
    ? readableErrorMessageFrom(deleteLead.error)
    : error
      ? readableErrorMessageFrom(error)
      : null;

  if (!site.id || !online) {
    return (
      <div data-component="empty-page">
        <div data-slot="icon">
          <UsersIcon size={28} />
        </div>
        <h2>Your leads, in one place</h2>
        <p>When visitors reach out through your site, their inquiries will appear here.</p>
        <Link to="/sites/$siteId/editor" params={{ siteId }} className="dark-button">
          Customize your site <ArrowRightIcon size={16} />
        </Link>
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
        <div data-component="banner" data-kind="error">
          <span>{errorMessage}</span>
        </div>
      )}

      {leads.length === 0 && !isFetching ? (
        <div data-component="empty-page">
          <div data-slot="icon">
            <UsersIcon size={28} />
          </div>
          <h2>No leads yet</h2>
          <p>Add a contact form to your site — messages from visitors will show up here.</p>
          <Link to="/sites/$siteId/editor" params={{ siteId }} className="dark-button">
            Open editor <ArrowRightIcon size={16} />
          </Link>
        </div>
      ) : (
        <div data-slot="lead-list">
          {leads.map((lead) => (
            <div data-slot="lead-card" key={lead.id}>
              <div data-slot="lead-body">
                <div data-slot="lead-head">
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
