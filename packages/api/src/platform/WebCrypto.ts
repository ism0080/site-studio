import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";

export const WebCrypto = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    randomBytes: (size) => {
      const bytes = new Uint8Array(size);
      crypto.getRandomValues(bytes);
      return bytes;
    },
    digest: (algorithm, data) =>
      Effect.tryPromise({
        // SAFETY: `data` is a Uint8Array of the effect Crypto service's choosing; WebCrypto.digest
        // accepts any BufferSource (Uint8Array / ArrayBuffer / typed-array), so the cast is sound.
        try: () =>
          crypto.subtle
            .digest(algorithm, data as BufferSource)
            .then((buffer) => new Uint8Array(buffer)),
        catch: (cause) =>
          PlatformError.systemError({
            module: "Crypto",
            method: "digest",
            _tag: "Unknown",
            description: "Could not compute digest",
            cause,
          }),
      }),
  }),
);
