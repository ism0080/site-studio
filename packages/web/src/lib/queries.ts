import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateSitePayload, DomainSetup, Site } from "../types.ts";
import { api } from "./api.ts";

// Query options factories (https://tkdodo.eu/blog/effective-react-query-keys):
// collocate every key with a shape helper so related queries invalidate
// together and stale lists are refreshed whenever a mutation lands. Callers
// pass the factory result straight to useQuery and spread `enabled` when the
// query must wait (auth, offline) rather than wrapping it in a custom hook.

export const siteQueries = {
  all: () => ["sites"] as const,
  lists: () => [...siteQueries.all(), "list"] as const,
  list: () =>
    queryOptions({
      queryKey: siteQueries.lists(),
      queryFn: api.listSites,
    }),
  details: () => [...siteQueries.all(), "detail"] as const,
  detail: (id: string) =>
    queryOptions({
      queryKey: [...siteQueries.details(), id],
      queryFn: () => api.getSite(id),
    }),
};

export const leadQueries = {
  all: () => ["leads"] as const,
  lists: () => [...leadQueries.all(), "list"] as const,
  list: (siteId: string) =>
    queryOptions({
      queryKey: [...leadQueries.lists(), siteId],
      queryFn: () => api.listLeads(siteId),
    }),
};

export function useCreateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSitePayload) => api.createSite(payload),
    onSuccess: (site) => {
      queryClient.setQueryData(siteQueries.detail(site.id).queryKey, site);
      queryClient.invalidateQueries({ queryKey: siteQueries.lists() });
    },
  });
}

export function useUpdateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (site: Site) => api.updateSite(site.id, site),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueries.detail(updated.id).queryKey, updated);
      queryClient.setQueryData<Site[]>(siteQueries.lists(), (old) =>
        (old ?? []).map((s) => (s.id === updated.id ? updated : s)),
      );
    },
  });
}

export function usePublishSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.publishSite(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: siteQueries.detail(result.siteId).queryKey });
    },
  });
}

export function useSetDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, domain }: { id: string; domain: string }) => api.setDomain(id, domain),
    onSuccess: (setup: DomainSetup) => {
      queryClient.setQueryData(siteQueries.detail(setup.site.id).queryKey, setup.site);
      queryClient.setQueryData<Site[]>(siteQueries.lists(), (old) =>
        (old ?? []).map((s) => (s.id === setup.site.id ? setup.site : s)),
      );
    },
  });
}

export function useVerifyDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.verifyDomain(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueries.detail(updated.id).queryKey, updated);
      queryClient.setQueryData<Site[]>(siteQueries.lists(), (old) =>
        (old ?? []).map((s) => (s.id === updated.id ? updated : s)),
      );
    },
  });
}

export function useRemoveDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.removeDomain(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueries.detail(updated.id).queryKey, updated);
      queryClient.setQueryData<Site[]>(siteQueries.lists(), (old) =>
        (old ?? []).map((s) => (s.id === updated.id ? updated : s)),
      );
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, leadId }: { siteId: string; leadId: string }) =>
      api.deleteLead(siteId, leadId),
    onSuccess: (_result, { siteId }) => {
      queryClient.invalidateQueries({ queryKey: leadQueries.list(siteId).queryKey });
    },
  });
}
