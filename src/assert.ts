/**
 * assert.ts
 *
 * Enables SceneryStack assertions for development debugging.
 * Must run after init.ts to ensure initialization is complete.
 */

import "./init.js";
import { enableAssert } from "scenerystack/assert";

// Enable assertions. This can be commented out if desired (assertions will be stripped from SceneryStack itself in
// production builds, but the assert() method can still be active).
enableAssert();
