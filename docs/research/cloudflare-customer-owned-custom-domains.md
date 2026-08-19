# Customer-owned custom domains on the Cloudflare Worker architecture

Research date: 2026-08-19. Primary sources only. The repository convention is
`docs/research/*.md`.

## Recommendation

Use **Cloudflare for SaaS custom hostnames** in front of the existing `www`
Worker. Start with customer-owned **subdomains** such as
`www.customer.com`. This is the smallest supported path that does not require
Cloudflare to own the customer's DNS zone:

1. Enable Cloudflare for SaaS on the existing SaaS zone and configure a
   proxied fallback origin. The repository already has a `www` Worker with an
   optional Worker Custom Domain (`packages/api/src/wwwWorker.ts:18-33`), which
   can be used as the origin-facing endpoint after it is represented by a
   proxied DNS record.
2. Create a friendly proxied CNAME target such as
   `customers.site-studio.example` pointing at the fallback origin.
3. For each customer, create a custom hostname through
   `POST /zones/{zone_id}/custom_hostnames`, using HTTP, TXT, or email DCV as
   appropriate.
4. Ask the customer to create `www.customer.com CNAME
   customers.site-studio.example` at their authoritative DNS provider.
5. Poll the custom-hostname details until both `status` and `ssl.status` are
   `active`, then add/maintain the site's domain-to-site mapping. The current
   Worker already resolves the request hostname through `site_domains`
   (`packages/api/src/wwwWorker.ts:58-69`).

Cloudflare's documented production readiness condition is `status: active`,
`ssl.status: active`, and DNS pointing at the SaaS target. See [SaaS setup and
readiness](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/).

## Comparison

| Option | Customer DNS operation | Cloudflare ownership requirement | Apex support | Current documented limits/cost | Fit |
| --- | --- | --- | --- | --- | --- |
| Customer subdomain, e.g. `www.customer.com`, via SaaS custom hostname | Customer adds a CNAME to our CNAME target | Customer zone remains outside our account; Cloudflare validates ownership | Yes for the hostname itself; it is a subdomain | Free/Pro/Business: 100 hostnames included, 50,000 maximum, then $0.10 per additional hostname. Enterprise: custom pricing and custom included amount; maximum unlimited, with sales contact above 50,000. | **Recommended first release** |
| Customer apex, e.g. `customer.com`, via SaaS custom hostname | Normally needs an A record to Cloudflare-provided static IPs | Same SaaS ownership validation | Not in the standard CNAME setup. Apex Proxying or BYOIP is an Enterprise paid add-on; static IP prefix cost is account-team quoted. | Same hostname metering, plus the Enterprise apex add-on and its quoted static-IP/BYOIP cost | Later, if apex is a hard requirement |
| Cloudflare for SaaS custom hostnames | Provider creates the hostname by API; customer changes DNS and completes validation | SaaS zone is ours; customer proves control of the hostname | Standard SaaS supports vanity subdomains. Apex Proxying/BYOIP is separately restricted as above. | SaaS is bundled with non-Enterprise plans; 100 included and $0.10/additional on Free/Pro/Business; 50,000 max on those plans | **The mechanism to use** |
| Ordinary Worker Custom Domain | Cloudflare creates the DNS record and certificate | Requires an active Cloudflare zone that we own; cannot be created on a zone we do not own | Supports an apex or subdomain within that owned zone | 100 Worker Custom Domains per zone; no separate per-domain price is stated in the Worker docs. Workers Paid is a separate minimum $5/month account plan. | Only for our zones, not arbitrary customer-owned domains |

The SaaS plan table is the source for the hostname counts and `$0.10` price:
[Cloudflare for SaaS plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/).
The ordinary Worker limit is in [Workers platform
limits](https://developers.cloudflare.com/workers/platform/limits/#routes-and-domains),
and the ownership restriction is explicit in [Worker Custom
Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## DNS and certificate requirements

### SaaS subdomains

The customer must point the custom hostname to the provider's CNAME target.
Cloudflare's example is `mystore.example.com CNAME
customers.saasprovider.com`. The target should ultimately be a proxied record
to the fallback origin. A customer using another CDN is not compatible when
that CDN hides the DNS records needed for validation.

Sources: [SaaS getting
started](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/)
and [hostname
validation](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/hostname-validation/).

Hostname ownership validation and certificate validation are separate:

- Hostname activation uses `ownership_verification` or
  `ownership_verification_http` and controls the custom hostname `status`.
- Certificate issuance uses `ssl.validation_records` and controls
  `ssl.status`.
- The API accepts `ssl.method` values `http`, `txt`, or `email`.
- Automatic HTTP certificate validation is the lowest-effort onboarding path,
  but the customer must point DNS first and there can be a short downtime
  window. TXT validation or delegated DCV can issue the certificate before
  cutover and reduce that risk.
- Cloudflare normally issues two certificates per custom hostname: ECDSA/P-256
  and RSA 2048 fallback certificates.

Sources: [SaaS certificate validation](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/issue-and-validate/validate-certificates/)
and the [Create Custom Hostname API](https://developers.cloudflare.com/api/resources/custom_hostnames/subresources/custom_hostnames/methods/create/).

### Apex domains

Most DNS providers do not allow a CNAME at the zone root. Cloudflare's standard
SaaS setup therefore does not support a customer pointing an apex with an A
record to the SaaS target. Cloudflare's **Apex Proxying** assigns static IP
prefixes so customers can use ordinary A records; the feature is available only
to certain customers, and the plans table identifies it as an Enterprise paid
add-on. BYOIP is the alternative Enterprise add-on. Cloudflare says the cost of
static IP prefixes is associated and to contact the account team, so there is no
public fixed price to record here.

Sources: [Apex proxying](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/apex-proxying/)
and [SaaS plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/).

### Ordinary Worker Custom Domains

An ordinary Custom Domain automatically creates DNS records and issues the
necessary certificate, but it requires an active Cloudflare zone and Worker.
Cloudflare explicitly says it cannot be created on a hostname with an existing
CNAME or on a zone we do not own. Its API attaches a hostname to a Worker using
`PUT /accounts/{account_id}/workers/domains`; the API model requires the zone
containing the hostname and says the hostname can be an apex or subdomain of
that zone.

Sources: [Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
and [Workers Domains API](https://developers.cloudflare.com/api/resources/workers/subresources/domains/).

Therefore, ordinary Custom Domains cannot be safely automated for arbitrary
customer-owned domains. It would require bringing each customer zone under our
Cloudflare account/control, which is a materially different onboarding model.

## Pricing context

- Cloudflare for SaaS is bundled with Free, Pro, and Business plans. Those plans
  include 100 custom hostnames and charge `$0.10` for each additional hostname,
  with a 50,000 maximum. Enterprise terms are custom.
- The Worker runtime is separately billed. Workers Paid has a `$5 USD/month`
  minimum account charge and includes 10 million requests/month; the SaaS
  hostname fee is separate from Worker request/CPU usage.
- Apex Proxying/BYOIP and Enterprise certificate/customization features are not
  priced publicly in the cited docs; they require Enterprise/account-team
  terms. Do not model those as a known fixed per-domain cost.

Sources: [SaaS plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/)
and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Smallest implementation boundary for this repository

No application code was changed by this research. The smallest eventual
vertical slice is:

- Cloudflare configuration: enable SaaS, fallback origin, and CNAME target.
- API onboarding operation: validate/normalize the requested hostname, create
  the custom hostname, return the DNS/DCV instructions, and reconcile status.
- Persistence: store the provider custom-hostname ID/status alongside the
  existing domain mapping so removal and retries are idempotent.
- Request path: no hostname-routing rewrite is needed in `wwwWorker`; it
  already looks up the normalized request hostname in `site_domains`.

Do not create one Worker or one ordinary Worker Custom Domain per customer.
Cloudflare for SaaS gives one shared Worker/fallback-origin architecture and
the API-managed hostname lifecycle that this multi-site Worker needs.

## Sources checked

- [Cloudflare for SaaS overview](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/)
- [Cloudflare for SaaS plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/)
- [SaaS custom hostnames](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/)
- [SaaS getting started](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/)
- [SaaS hostname validation](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/hostname-validation/)
- [SaaS certificate validation](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/issue-and-validate/validate-certificates/)
- [Create Custom Hostname API](https://developers.cloudflare.com/api/resources/custom_hostnames/subresources/custom_hostnames/methods/create/)
- [SaaS Apex Proxying](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/apex-proxying/)
- [Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Workers Domains API](https://developers.cloudflare.com/api/resources/workers/subresources/domains/)
- [Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

## AWS and Google Cloud comparison

AWS can support customer apex domains with CloudFront. CloudFront accepts an
alternate domain name for the apex when the attached certificate explicitly
covers the apex, and Route 53 can point the apex to CloudFront with an ALIAS
record. Customers using another DNS provider need an equivalent apex alias,
flattening, or AWS Anycast static-IP arrangement. ACM public certificates are
free and automatically renewed, but each customer hostname still has to be
authorized and represented in the CloudFront configuration/certificate
lifecycle.

Sources: [CloudFront alternate domain names](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html),
[ACM certificate characteristics](https://docs.aws.amazon.com/acm/latest/userguide/acm-certificate-characteristics.html),
and [CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/).

AWS therefore removes Cloudflare's standard-SaaS apex restriction, but it does
not provide the same simple `$0.10` hostname-metering model. It introduces a
CloudFront distribution/origin design, certificate management, and potentially
Route 53 or static-IP costs. It would also require an adapter in this
repository because the current Worker expects the original request hostname
for its `site_domains` lookup.

Google Cloud can support apex domains with a global external HTTPS Application
Load Balancer and a Google-managed certificate. Customers point A and AAAA
records at the load balancer's static IP, and Google manages certificate
renewal. This is a general load-balancing building block, not a SaaS custom
hostname product: the application must create and update certificates,
certificate maps, and load-balancer configuration as customers onboard.

Sources: [Google-managed SSL certificates](https://cloud.google.com/load-balancing/docs/ssl-certificates/google-managed-certs),
[Cloud CDN pricing](https://cloud.google.com/cdn/pricing),
and [Cloud Load Balancing pricing](https://cloud.google.com/load-balancing/pricing).

For this static-site product, neither AWS nor Google is a lower-complexity
replacement for Cloudflare. Cloudflare remains the cheapest first release if
we accept `www.customer.com`; AWS is the strongest alternative if bare apex
domains are a launch requirement and the additional infrastructure cost is
acceptable. Supporting apex domains on the current Cloudflare stack should be
treated as an Enterprise-priced feature, not a `$0.10` feature.

## Vercel comparison

Vercel has a more direct multi-tenant custom-domain product. Its Vercel for
Platforms documentation explicitly supports tenant apex domains, such as
`tenant.com`, and provides an SDK/API to add, verify, and remove domains on one
project. Vercel automatically issues SSL certificates for verified domains.
Customers can configure an apex with an A record, or use nameservers; a
subdomain uses a CNAME. The documentation also describes adding both the apex
and `www` hostname and redirecting one to the other.

Vercel's current multi-tenant limits list 50 custom domains on Hobby and
unlimited custom domains on Pro, with a soft limit of 100,000 domains per Pro
project. Vercel's pricing page lists Hobby at `$0/month` and Pro at `$20/month`,
but Hobby is intended for personal, non-commercial use. There is no published
per-custom-domain fee in the cited material. API rate limits are 100 domain
additions/hour and 50 verifications/hour per team.

Sources: [Vercel multi-tenant domain configuration](https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains),
[Vercel multi-tenant limits](https://vercel.com/docs/platforms/multi-tenant-platforms/limits),
[Vercel domain setup](https://vercel.com/docs/domains/working-with-domains/add-a-domain),
and [Vercel pricing](https://vercel.com/pricing).

Vercel is therefore the strongest low-cost apex-domain candidate if we are
willing to make Vercel the public hosting/front-door layer. It is not a drop-in
DNS or TLS add-on for the current Cloudflare Worker: the published artifacts
would need to be served by a Vercel project, or a Vercel project would need to
proxy to the existing Worker and route tenants by the incoming hostname. The
existing `site_domains` model remains reusable, but the deployment and cache
boundary would change.
