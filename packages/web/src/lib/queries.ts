import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateSitePayload, DomainSetup, MemberInput, Site } from "../types.ts";
import { api } from "./api.ts";

// Query options factories (https://tkdodo.eu/blog/effective-react-query-keys):
// collocate every key with a shape helper so related queries invalidate
// together and stale lists are refreshed whenever a mutation lands. Callers
// pass the factory result straight to useQuery and spread `enabled` when the
// query must wait (auth, offline) rather than wrapping it in a custom hook.

export const meQueries = {
  all: () => ["me"] as const,
  me: () =>
    queryOptions({
      queryKey: meQueries.all(),
      queryFn: api.me,
    }),
};

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

export const accessQueries = {
  all: () => ["access"] as const,
  detail: (siteId: string) =>
    queryOptions({
      queryKey: [...accessQueries.all(), siteId],
      queryFn: () => api.getSiteAccess(siteId),
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

export const memberQueries = {
  all: () => ["members"] as const,
  lists: () => [...memberQueries.all(), "list"] as const,
  list: (siteId: string) =>
    queryOptions({
      queryKey: [...memberQueries.lists(), siteId],
      queryFn: () => api.listMembers(siteId),
    }),
};

export const agencyQueries = {
  all: () => ["agencies"] as const,
  list: () =>
    queryOptions({
      queryKey: agencyQueries.all(),
      queryFn: api.listAgencies,
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
      queryClient.setQueryData<readonly Site[]>(siteQueries.lists(), (old) =>
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
      queryClient.setQueryData<readonly Site[]>(siteQueries.lists(), (old) =>
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
      queryClient.setQueryData<readonly Site[]>(siteQueries.lists(), (old) =>
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
      queryClient.setQueryData<readonly Site[]>(siteQueries.lists(), (old) =>
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

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, input }: { siteId: string; input: MemberInput }) =>
      api.inviteMember(siteId, input),
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: memberQueries.list(member.siteId).queryKey });
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, email, input }: { siteId: string; email: string; input: MemberInput }) =>
      api.updateMember(siteId, email, input),
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: memberQueries.list(member.siteId).queryKey });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, email }: { siteId: string; email: string }) =>
      api.removeMember(siteId, email),
    onSuccess: (_result, { siteId }) => {
      queryClient.invalidateQueries({ queryKey: memberQueries.list(siteId).queryKey });
    },
  });
}

export function useInviteAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api.inviteAgency(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyQueries.list().queryKey });
    },
  });
}

export function useRemoveAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api.removeAgency(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyQueries.list().queryKey });
    },
  });
}
