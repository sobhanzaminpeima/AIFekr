import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHAT_STRINGS, chatCopy } from "./chatCopy";

const classic = ["components/chat/ChatInterface.tsx", "components/chat/OrchestratorActionCard.tsx"].map((f) => readFileSync(join(__dirname, "../..", f), "utf8")).join("\n");

describe("new-design chat wording", () => {
  it("is word for word the classic chat's", () => {
    const parts = CHAT_STRINGS.flat().flatMap((s) => s.split("{n}")).map((p) => p.replace(/"/g, '\\"')).filter((p) => p.trim());
    expect(parts.filter((p) => !classic.includes(p) && !classic.includes(p.replace(/\\"/g, '"')))).toEqual([]);
  });
  it("localizes options and keys strings by their English text", () => {
    const de = chatCopy("de");
    expect(de.strings["Video generation failed"]).toBe("Videogenerierung fehlgeschlagen");
    expect(de.expertModes[0]).toMatchObject({ id: "default", label: "Intelligenter Assistent" });
    expect(chatCopy("tr").dataSources.crm).toBe("your CRM");
    expect(chatCopy("fa").dataSources.crm).toBe("CRM شما");
    expect(chatCopy("tr").starters.general).toEqual(chatCopy("en").starters.general);
    expect(chatCopy("fa").mediaTabs.map((t) => t.id)).toEqual(["chat", "image", "video", "music"]);
  });
});
