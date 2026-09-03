import { describe, expect, it } from "vitest";
import { completionDocument } from "./auth-completion";

describe("Plex authentication completion page", () => {
  it("closes the popup and provides a safe fallback link", () => {
    const html = completionDocument();
    expect(html).toContain("window.close()");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("authenticated");
  });
  it("stops retrying when the login session expired", () => {
    const html = completionDocument("expired");
    expect(html).toContain("Connection expired");
    expect(html).not.toContain('http-equiv="refresh"');
  });
});