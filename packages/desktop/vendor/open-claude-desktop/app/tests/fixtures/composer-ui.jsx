import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { SourceComposer, SourceEffortPopover } from "../../src/source-composer";
import { SourceGreeting, SourceStatsCard } from "../../src/source-home";
import { SourceMenu } from "../../src/source-menu";
import "../../src/style.css";
import "../../src/source-composer.css";

// Isolated fixture data is never read by the production entry point.
const efforts = ["low", "medium", "high", "xhigh"].map((reasoningEffort) => ({
  reasoningEffort,
  description: `Fixture description for ${reasoningEffort} reasoning effort.`,
}));
const now = new Date();
const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const models = [
  {
    id: "fixture",
    model: "fixture",
    displayName: "Fixture model",
    supportedReasoningEfforts: efforts,
  },
];
// The card reads the original getCodeStats object (main.cjs 'stats').
const stats = {
  dailyActivity: [{ date: day, messageCount: 12, sessionCount: 1, toolCallCount: 0 }],
  dailyModelTokens: [{ date: day, tokensByModel: { fixture: 32000 } }],
  modelUsage: { fixture: { inputTokens: 20000, outputTokens: 12000, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } },
  peakActivityHour: 9,
};
function Fixture() {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [effort, setEffort] = useState("low");
  const [worktree, setWorktree] = useState(false);
  const [menu, setMenu] = useState(null);
  const [sent, setSent] = useState(0);
  const [attempts, setAttempts] = useState(1);
  const [connected, setConnected] = useState(false);
  const input = useRef(null);
  return (
    <div
      className="epitaxy-root"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "32px 0 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 832,
          padding: "0 32px",
          margin: "0 auto",
        }}
      >
        <SourceGreeting displayName="Fixture" />
        <div style={{ paddingTop: 24 }}>
          <SourceStatsCard stats={stats} models={models} bookSeed={0} />
        </div>
        <div style={{ paddingTop: 24 }} data-fixture="hold">
          <SourceStatsCard stats={undefined} models={models} />
        </div>
        <div style={{ paddingTop: 24 }} data-fixture="failed">
          <SourceStatsCard failed attempts={attempts} connected={connected} onRetry={() => setAttempts((value) => value + 1)} />
          <button type="button" onClick={() => setConnected((value) => !value)}>Fixture reconnect</button>
        </div>
        <output aria-label="Submitted messages">{sent}</output>
      </div>
      <div style={{ flex: 1 }} />
      <SourceComposer
        draft={draft}
        setDraft={setDraft}
        textarea={input}
        attachments={attachments}
        setAttachments={setAttachments}
        onSubmit={() => {
          setSent((value) => value + 1);
          setDraft("");
        }}
        workdir="/fixture/project"
        workspaceInfo={{ isRepo: true, branch: "main" }}
        onMenu={(kind, anchor) => setMenu({ kind, anchor })}
        model={models[0]}
        effort={effort}
        permission="auto"
        worktree={worktree}
        setWorktree={setWorktree}
        showPet
        isHome
        mode="code"
        onFolder={() => setAttachments(["/fixture/example.txt"])}
        onAddFolder={() => setAttachments(["/fixture/example.txt"])}
      />
      {/* The effort chip opens the CDS Popover host (source-composer.jsx SourceEffortPopover); every other
          chip opens a placeholder CDS menu in this isolated fixture. */}
      {menu && (menu.kind === "effort"
        ? <SourceEffortPopover anchor={menu.anchor} levels={efforts} value={effort} onChange={setEffort} onClose={() => setMenu(null)} />
        : <SourceMenu.Popup anchor={menu.anchor} side="top" align="end" label={menu.kind} onClose={() => setMenu(null)}>
            <SourceMenu.Item>{menu.kind} fixture menu</SourceMenu.Item>
          </SourceMenu.Popup>)}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Fixture />);
