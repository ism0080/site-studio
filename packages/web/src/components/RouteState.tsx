import { Link } from "@tanstack/react-router";
import "./RouteState.css";

/** Shown while a route's code-split chunk or loader is still resolving. */
export function RoutePending() {
  return (
    <div data-component="route-pending" role="status">
      <span data-slot="spinner" aria-hidden="true" />
      Loading…
    </div>
  );
}

/** Shown when a route fails to load or its component throws. */
export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div data-component="route-error" role="alert">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button className="light-button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}

/** Shown for URLs that don't match any route. */
export function RouteNotFound() {
  return (
    <div data-component="route-error">
      <h2>Page not found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/" className="dark-button">
        Go to your sites
      </Link>
    </div>
  );
}
