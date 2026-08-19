import { setupWorker } from "msw/browser";
import { mockApiHandlers } from "./mockApiHandlers.ts";

export const mockWorker = setupWorker(...mockApiHandlers);