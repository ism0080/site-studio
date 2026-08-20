import type { ReactNode } from "react";
import { useMachine } from "@xstate/react";
import { assign, setup } from "xstate";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, GlobeHemisphereWest } from "@phosphor-icons/react";

import { siteQueries, templateQueries, useCreateSite } from "../lib/apiQueries.ts";
import type { Business, Template } from "../siteTypes.ts";

export const Route = createFileRoute("/_auth/onboarding")({ component: Onboarding });

const CATEGORIES = [
  "Professional services",
  "Creative studio",
  "Retail & ecommerce",
  "Health & wellness",
  "Food & hospitality",
  "Other",
];

type Profile = { name: string; subdomain: string; templateId: string; business: Business };
export type OnboardingContext = { step: number; profile: Profile };
export type OnboardingEvent =
  | { type: "UPDATE"; changes: Partial<Profile> }
  | { type: "UPDATE_BUSINESS"; changes: Partial<Business> }
  | { type: "NEXT" }
  | { type: "BACK" };

const initialProfile: Profile = {
  name: "",
  subdomain: "",
  templateId: "",
  business: { name: "", category: "", location: "", email: "", phone: "", logo: "" },
};

const onboardingMachine = setup({
  // SAFETY: XState uses this empty-object assertion only to carry the machine's
  // context and event contracts; neither value is read at runtime.
  types: {
    context: {} as OnboardingContext,
    events: {} as OnboardingEvent,
  },
}).createMachine({
  context: { step: 1, profile: initialProfile },
  on: {
    UPDATE: {
      actions: assign({
        profile: ({ context, event }) => ({ ...context.profile, ...event.changes }),
      }),
    },
    UPDATE_BUSINESS: {
      actions: assign({
        profile: ({ context, event }) => ({
          ...context.profile,
          business: { ...context.profile.business, ...event.changes },
        }),
      }),
    },
    NEXT: { actions: assign({ step: ({ context }) => Math.min(4, context.step + 1) }) },
    BACK: { actions: assign({ step: ({ context }) => Math.max(1, context.step - 1) }) },
  },
});

function Onboarding() {
  const navigate = useNavigate();
  const [snapshot, send] = useMachine(onboardingMachine);
  const { data: sites = [] } = useQuery(siteQueries.list());
  const { data: templates = [] } = useQuery(templateQueries.list());
  const createSite = useCreateSite();
  const { step, profile } = snapshot.context;

  if (sites.length > 0) return <Navigate to="/" replace />;

  const canContinue =
    step === 1
      ? profile.name.trim() && profile.subdomain.trim()
      : step === 2
        ? profile.business.category
        : step === 3
          ? profile.templateId
          : profile.business.email.trim();
  const selectedTemplate = templates.find((template) => template.id === profile.templateId);

  return (
    <div data-component="onboarding">
      <header data-slot="onboarding-header">
        <strong>SiteStudio</strong>
        <span>New site setup</span>
      </header>
      <main data-slot="onboarding-main">
        <div data-slot="progress">
          <span>Step {step} of 4</span>
          <div data-step={step}>
            <i />
          </div>
        </div>
        {step === 1 && (
          <IdentityStep
            profile={profile}
            update={(changes) => send({ type: "UPDATE", changes })}
            updateBusiness={(changes) => send({ type: "UPDATE_BUSINESS", changes })}
          />
        )}
        {step === 2 && (
          <CategoryStep
            profile={profile}
            updateBusiness={(changes) => send({ type: "UPDATE_BUSINESS", changes })}
          />
        )}
        {step === 3 && (
          <TemplateStep
            templates={templates}
            selected={profile.templateId}
            onSelect={(template) => send({ type: "UPDATE", changes: { templateId: template.id } })}
          />
        )}
        {step === 4 && (
          <ContactStep
            profile={profile}
            updateBusiness={(changes) => send({ type: "UPDATE_BUSINESS", changes })}
            template={selectedTemplate}
          />
        )}
        <div data-slot="onboarding-actions">
          {step > 1 && (
            <button
              data-component="button"
              data-size="large"
              onClick={() => send({ type: "BACK" })}
            >
              <ArrowLeft /> Back
            </button>
          )}
          {step < 4 ? (
            <button
              data-component="button"
              data-color="primary"
              data-size="large"
              disabled={!canContinue}
              onClick={() => send({ type: "NEXT" })}
            >
              Continue <ArrowRight />
            </button>
          ) : (
            <button
              data-component="button"
              data-color="primary"
              data-size="large"
              disabled={!canContinue || createSite.isPending}
              onClick={() =>
                createSite.mutate(profile, {
                  onSuccess: (site) =>
                    navigate({ to: "/sites/$siteId/editor", params: { siteId: site.id } }),
                })
              }
            >
              {createSite.isPending ? "Creating your site..." : "Create my site"} <Check />
            </button>
          )}
        </div>
        {createSite.isError && (
          <p data-slot="form-error">We couldn't create your site. Please try again.</p>
        )}
      </main>
    </div>
  );
}

function IdentityStep({
  profile,
  update,
  updateBusiness,
}: {
  profile: Profile;
  update: (changes: Partial<Profile>) => void;
  updateBusiness: (changes: Partial<Profile["business"]>) => void;
}) {
  return (
    <StepShell
      eyebrow="Start with the basics"
      title="Give your site a home on the web."
      description="Your site name becomes the public brand name. Choose a short subdomain people can remember."
      body={
        <>
          <Field
            label="Business or site name"
            value={profile.name}
            placeholder="e.g. North Supply Co"
            onChange={(value) => {
              update({ name: value });
              updateBusiness({ name: value });
            }}
          />
          <Field
            label="Your SiteStudio address"
            value={profile.subdomain}
            prefix="https://"
            suffix=".sitestudio.site"
            placeholder="north-supply"
            onChange={(value) =>
              update({ subdomain: value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
            }
          />
          <p className="field-note">
            <GlobeHemisphereWest /> You can connect a custom domain later.
          </p>
        </>
      }
    />
  );
}

function CategoryStep({
  profile,
  updateBusiness,
}: {
  profile: Profile;
  updateBusiness: (changes: Partial<Profile["business"]>) => void;
}) {
  return (
    <StepShell
      eyebrow="Find your direction"
      title="What kind of business is this?"
      description="This helps us tailor your starting content and template recommendations."
      body={
        <div data-slot="choice-grid">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              data-slot="choice"
              data-selected={profile.business.category === category}
              onClick={() => updateBusiness({ category })}
            >
              {category}
              {profile.business.category === category && <Check />}
            </button>
          ))}
        </div>
      }
    />
  );
}

function TemplateStep({
  templates,
  selected,
  onSelect,
}: {
  templates: readonly Template[];
  selected: string;
  onSelect: (template: Template) => void;
}) {
  return (
    <StepShell
      eyebrow="Set the tone"
      title="Choose a starting point."
      description="Pick the visual direction that feels closest. Everything can be changed later."
      body={
        <div data-slot="onboarding-templates">
          {templates.map((template) => (
            <button
              key={template.id}
              data-slot="template-choice"
              data-selected={selected === template.id}
              onClick={() => onSelect(template)}
            >
              <div data-slot="template-art" data-template={template.id}>
                <b>{template.brand}</b>
                <strong>{template.title.join(" ")}</strong>
                <i />
              </div>
              <span>
                <strong>{template.name}</strong>
                <small>{template.category}</small>
              </span>
              {selected === template.id && <Check data-slot="selected-icon" />}
            </button>
          ))}
        </div>
      }
    />
  );
}

function ContactStep({
  profile,
  updateBusiness,
  template,
}: {
  profile: Profile;
  updateBusiness: (changes: Partial<Profile["business"]>) => void;
  template?: Template;
}) {
  return (
    <StepShell
      eyebrow="Make it yours"
      title="Add your core business information."
      description="We'll use these details to shape your homepage and make it easy for visitors to reach you."
      body={
        <>
          <div className="field-row">
            <Field
              label="Email address"
              type="email"
              value={profile.business.email}
              placeholder="hello@yourbusiness.com"
              onChange={(value) => updateBusiness({ email: value })}
            />
            <Field
              label="Phone (optional)"
              value={profile.business.phone}
              placeholder="(555) 123-4567"
              onChange={(value) => updateBusiness({ phone: value })}
            />
          </div>
          <Field
            label="Location (optional)"
            value={profile.business.location}
            placeholder="Portland, Oregon"
            onChange={(value) => updateBusiness({ location: value })}
          />
          <div data-slot="setup-summary">
            <span>Starting with</span>
            <strong>{template?.name ?? "Your chosen template"}</strong>
            <small>
              {profile.business.category} · {profile.subdomain}.sitestudio.site
            </small>
          </div>
        </>
      }
    />
  );
}

function StepShell({
  eyebrow,
  title,
  description,
  body,
}: {
  eyebrow: string;
  title: string;
  description: string;
  body: ReactNode;
}) {
  return (
    <section data-slot="step">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p data-slot="description">{description}</p>
      <div data-slot="step-body">{body}</div>
    </section>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  prefix,
  suffix,
  type = "text",
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  type?: string;
}) {
  return (
    <label className="onboarding-field">
      <span>{label}</span>
      <div>
        {prefix && <em>{prefix}</em>}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}
