# Repository Guidance

## Code Style: Happy-Path-First, Evidence-Driven Design

Implement changes with this style: **happy-path-first, use-case-oriented design with
deep modules, type-driven invariants, boundary isolation, and evidence-driven complexity.**

### Orchestration

- Top-level methods coordinate a use case and read almost like English. They call
  well-named domain methods/services; they do not contain parsing, process plumbing,
  protocol details, state surgery, or long validation branches.
- The happy path is the 95% case and should be ~95% of the code readers see. Keep it
  flat and linear; do not bury it inside defensive branches.

```ts
// DO
async function update(version: Version) {
  await server.stop()
  await cli.install(version)
  await cli.requireVersion(version)
  await server.start()
}

// DON'T
async function update(input: string) {
  if (!input) throw new Error("missing version")
  const child = spawn("wsl", ["bash", "-lc", buildScript(input)])
  const result = await collectOutput(child)
  if (result.code !== 0) throw new Error(result.stderr)
  const installed = parseVersion(await runVersionCommand())
  if (installed !== input) throw new Error("wrong version")
  await killExistingProcess()
  await startProcess()
}
```

### Guard Clauses And Flat Control Flow

- Reject invalid inputs and failed invariants early with guards, returns, assertions,
  and throws. Keep the valid path flat.

```ts
// DO
if (!config) return
if (!config.enabled) return
assert(server.ready)
return run(config)

// DON'T
if (config) {
  if (config.enabled) {
    if (server.ready) {
      return run(config)
    }
  }
}
return undefined
```

### Types Enforce Invariants

- Make invalid states unrepresentable. Model legal states with discriminated unions,
  not nullable fields and booleans.
- Parse external/persisted/network data once at the boundary into a trusted domain
  value (e.g. `Version.parse(input)`), then pass the trusted value everywhere.
- No `any`, loose string protocols, or repeated re-validation of already-trusted data.
- Required dependencies must be explicit and impossible to omit; prefer small cohesive
  interfaces over bags of optional callbacks, booleans, and behavior flags.

```ts
type ServerState =
  | { kind: "stopped" }
  | { kind: "starting" }
  | { kind: "ready"; url: ServerUrl }
  | { kind: "failed"; error: ServerError }
```

### Patterns Must Pay Rent

- Patterns, layers, abstractions, interfaces, and files are costs. Use them only when
  they produce a concrete readability, maintenance, correctness, testing, or
  change-isolation gain larger than their cost.
- Start with the smallest honest use-case implementation (often a direct transaction
  script or vertical slice). Add a port, repository, service, or value object only when
  it owns a real invariant, hides real complexity, has multiple real implementations,
  removes stable duplication, or creates a proven boundary.
- No `Controller -> Service -> Repository` chains just because a framework or blog post
  suggests them. A repository that only renames one database call is a shallow module.
- Prefer duplication over the wrong abstraction. Extract reuse only after real examples
  reveal the shared shape (Rule of Three / semantic compression).

### Evidence Before Complexity

- Do not defend against theoretical or unproven edge cases. Wait for a real runtime
  failure, log, test reproduction, persisted state, or user report.
- Never justify complexity with "could", "might", or "what if" alone. State the
  observed failure and its likelihood.
- When evidence proves an edge case, fix the smallest real failure at the boundary that
  owns it. Do not build a general lifecycle/framework to defend against one incident.
- Remove duplication, stale compatibility code, speculative safeguards, and fallback
  chains. Prefer less code, fewer names, and net-negative diffs when behavior permits.

### Deep Modules, Not Helper Shrapnel

- Extract one deep operation whose interface hides real complexity, not shallow helpers
  that force readers to reconstruct a single operation:

```ts
// DO
await cli.installExactVersion(version)

// DON'T
prepareUpdate()
doUpdate()
finishUpdate()
```

### Encapsulation And State Ownership

- Tell the owner the domain operation; do not ask for owned state and mutate it elsewhere.

```ts
// DO
session.promote(message)

// DON'T
if (session.status() === "pending") {
  session.messages().push(message)
  session.setStatus("active")
}
```

### Domain Core And Infrastructure Boundaries

- Keep domain decisions in the core and IO in ports, adapters, or the imperative shell.
  Do not leak process/network/database calls into domain logic. Enforced by the
  `architecture` oxlint rules — do not work around them.

```ts
const event = session.promote(message)
await sessionStore.append(event)
```

### Tests At Stable Boundaries

- Prove behavior through real use-case boundaries and observable order, not
  implementation line-by-line.

```ts
await controller.update("Debian")
expect(events).toEqual(["stop", "install", "verify", "start"])
```

### Completion Standard

Finish the complete change, run focused verification, delete temporary artifacts, and
do one final simplification pass. The result should feel boring, obvious, typed,
cohesive, and native to the codebase.
