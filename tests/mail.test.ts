import { describe, expect, it } from "vitest";
import { classifyMail, matchMail, senderDomain } from "@/lib/mailmatch";

const projects = [
  { id: "a", name: "Monad", links: { site: "https://www.monad.xyz", x: "https://x.com/monad" }, mailMatchers: [] },
  { id: "b", name: "Ink", links: {}, mailMatchers: ["inkonchain.com"] },
];

describe("mail matching", () => {
  it("parses sender domain", () => {
    expect(senderDomain("Monad Team <hello@news.monad.xyz>")).toBe("news.monad.xyz");
  });
  it("matches by site root domain and by matcher", () => {
    expect(matchMail({ from: "Monad <hi@news.monad.xyz>", subject: "Update", snippet: "" }, projects)).toEqual(["a"]);
    expect(matchMail({ from: "noreply@inkonchain.com", subject: "Hello", snippet: "" }, projects)).toEqual(["b"]);
  });
  it("does not match on social domains", () => {
    expect(matchMail({ from: "notify@x.com", subject: "New login", snippet: "" }, projects)).toEqual([]);
  });
  it("classifies whitelist / claim / kyc mail", () => {
    expect(classifyMail({ from: "", subject: "You're in! Allowlist confirmed", snippet: "" })).toContain("whitelist");
    expect(classifyMail({ from: "", subject: "Your airdrop is live", snippet: "claim now" })).toContain("claim");
    expect(classifyMail({ from: "", subject: "Complete KYC", snippet: "" })).toContain("kyc");
  });
});
