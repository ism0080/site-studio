import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { billingQueries } from "../lib/apiQueries.ts";
import { readableErrorMessage } from "../lib/formatting.ts";
import { siteApi } from "../lib/siteApi.ts";

export const Route = createFileRoute("/_auth/billing")({
  component: Billing,
});

const _redirect = (url: string) => window.location.assign(url);

function Billing() {
  const { data: status, error } = useQuery(billingQueries.status());
  const checkout = useMutation({
    mutationFn: () => siteApi.startCheckout(`${window.location.origin}/`),
    onSuccess: ({ url }) => _redirect(url),
  });
  const portal = useMutation({
    mutationFn: () => siteApi.startPortal(`${window.location.origin}/billing`),
    onSuccess: ({ url }) => _redirect(url),
  });

  const actionError = checkout.error ?? portal.error;

  return (
    <main data-component="billing">
      <p className="eyebrow">Account</p>
      <h1>Billing</h1>

      {status === undefined && error === null && <p data-slot="note">Loading your plan…</p>}
      {error !== null && <p data-slot="form-error">{readableErrorMessage(error)}</p>}

      {status !== undefined && (
        <section data-slot="plan">
          {status.plan === "pro" ? (
            <>
              <h2>Pro</h2>
              <p>
                All templates, site analytics, and priority email support. Your sites can publish
                freely.
              </p>
            </>
          ) : (
            <>
              <h2>Free</h2>
              <p>
                One site with the starter template and free publishing. Upgrade to Pro for all
                templates, site analytics, and priority email support.
              </p>
            </>
          )}

          {!status.billingConfigured && (
            <p data-slot="note">Billing is not configured on this deployment yet.</p>
          )}

          <div data-slot="actions">
            {status.plan === "free" && status.billingConfigured && (
              <button
                type="button"
                data-component="button"
                data-color="primary"
                disabled={checkout.isPending}
                onClick={() => checkout.mutate()}
              >
                {checkout.isPending ? "Opening checkout…" : "Upgrade to Pro"}
              </button>
            )}
            {status.plan === "pro" && status.billingConfigured && (
              <button
                type="button"
                data-component="button"
                disabled={portal.isPending}
                onClick={() => portal.mutate()}
              >
                {portal.isPending ? "Opening portal…" : "Manage billing"}
              </button>
            )}
            <Link to="/" data-component="button">
              Back to workspace
            </Link>
          </div>

          {actionError !== null && (
            <p data-slot="form-error">{readableErrorMessage(actionError)}</p>
          )}
        </section>
      )}
    </main>
  );
}
