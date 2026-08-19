import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateSitePayload, DomainSetup, MemberInput, Site } from "../siteTypes.ts";
import { siteApi } from "./siteApi.ts";

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
      queryFn: siteApi.me,
    }),
};

export const templateQueries = {
  all: () => ["templates"] as const,
  list: () =>
    queryOptions({
      queryKey: templateQueries.all(),
      queryFn: siteApi.listTemplates,
      staleTime: Infinity,
    }),
};

export const siteQueries = {
  all: () => ["sites"] as const,
  lists: () => [...siteQueries.all(), "list"] as const,
  list: () =>
    queryOptions({
      queryKey: siteQueries.lists(),
      queryFn: siteApi.listSites,
    }),
  details: () => [...siteQueries.all(), "detail"] as const,
  detail: (id: string) =>
    queryOptions({
      queryKey: [...siteQueries.details(), id],
      queryFn: () => siteApi.getSite(id),
    }),
};

export const accessQueries = {
  all: () => ["access"] as const,
  detail: (siteId: string) =>
    queryOptions({
      queryKey: [...accessQueries.all(), siteId],
      queryFn: () => siteApi.getSiteAccess(siteId),
    }),
};

export const leadQueries = {
  all: () => ["leads"] as const,
  lists: () => [...leadQueries.all(), "list"] as const,
  list: (siteId: string) =>
    queryOptions({
      queryKey: [...leadQueries.lists(), siteId],
      queryFn: () => siteApi.listLeads(siteId),
    }),
};

export const memberQueries = {
  all: () => ["members"] as const,
  lists: () => [...memberQueries.all(), "list"] as const,
  list: (siteId: string) =>
    queryOptions({
      queryKey: [...memberQueries.lists(), siteId],
      queryFn: () => siteApi.listMembers(siteId),
    }),
};

export const agencyQueries = {
  all: () => ["agencies"] as const,
  list: () =>
    queryOptions({
      queryKey: agencyQueries.all(),
      queryFn: siteApi.listAgencies,
    }),
};

export function useCreateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSitePayload) => siteApi.createSite(payload),
    onSuccess: (site) => {
      queryClient.setQueryData(siteQueries.detail(site.id).queryKey, site);
      queryClient.invalidateQueries({ queryKey: siteQueries.lists() });
    },
  });
}

export function useUpdateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (site: Site) => siteApi.updateSite(site.id, site),
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
    mutationFn: (id: string) => siteApi.publishSite(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: siteQueries.detail(result.siteId).queryKey });
    },
  });
}

export function useSetDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, domain }: { id: string; domain: string }) => siteApi.setDomain(id, domain),
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
    mutationFn: (id: string) => siteApi.verifyDomain(id),
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
    mutationFn: (id: string) => siteApi.removeDomain(id),
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
      siteApi.deleteLead(siteId, leadId),
    onSuccess: (_result, { siteId }) => {
      queryClient.invalidateQueries({ queryKey: leadQueries.list(siteId).queryKey });
    },
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, input }: { siteId: string; input: MemberInput }) =>
      siteApi.inviteMember(siteId, input),
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: memberQueries.list(member.siteId).queryKey });
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, email, input }: { siteId: string; email: string; input: MemberInput }) =>
      siteApi.updateMember(siteId, email, input),
    onSuccess: (member) => {
      queryClient.invalidateQueries({ queryKey: memberQueries.list(member.siteId).queryKey });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, email }: { siteId: string; email: string }) =>
      siteApi.removeMember(siteId, email),
    onSuccess: (_result, { siteId }) => {
      queryClient.invalidateQueries({ queryKey: memberQueries.list(siteId).queryKey });
    },
  });
}

export function useInviteAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => siteApi.inviteAgency(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyQueries.list().queryKey });
    },
  });
}

export function useRemoveAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => siteApi.removeAgency(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyQueries.list().queryKey });
    },
  });
}
