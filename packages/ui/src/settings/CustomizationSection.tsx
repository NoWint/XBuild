/* 自定义中心：overrides 文件的图形化编辑器（spec §8）。
 * 设计取舍（P0）：文案直接中文字面量；保存为 500ms 防抖的整文档写回；
 * 非法文件由 host 侧 loader 校验并回传 warning，本页只展示不阻断。 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { HookRule, OverridesFileParsed, PromptAppendEntry } from "@zcode/shared";
import { Alert, AlertDescription } from "@/components/ui/alert.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { Switch } from "@/components/ui/switch.js";
import { Textarea } from "@/components/ui/textarea.js";
import { useServices } from "@/hooks/useServices.js";

/** 内置提示词段（与 core customization/loader.ts 的 BUILTIN_PROMPT_SECTION_SOURCES 同步）。 */
const BUILTIN_PROMPT_SECTIONS: ReadonlyArray<{ source: string; title: string }> = [
  { source: "cli_prefix", title: "产品前缀" },
  { source: "identity", title: "Agent 身份" },
  { source: "custom_system_prompt", title: "自定义系统提示词" },
  { source: "workflow_actor_identity", title: "工作流子代理身份" },
  { source: "desktop_context", title: "桌面端交互协议" },
  { source: "dynamic_behavior", title: "动态行为边界" },
  { source: "session_guidance", title: "会话指导" },
  { source: "context_management", title: "上下文管理" },
  { source: "memory", title: "长期记忆" },
  { source: "env_info", title: "环境信息" },
  { source: "model", title: "执行模型" },
  { source: "session_context", title: "Git 会话上下文" },
  { source: "skills", title: "可用技能" },
  { source: "request_user_context", title: "用户上下文" },
  { source: "current_date", title: "当前日期" },
];

const PANEL_IDS: ReadonlyArray<{ id: string; title: string }> = [
  { id: "panel.tasks", title: "任务列表" },
  { id: "panel.automations", title: "自动化" },
  { id: "panel.pluginStore", title: "插件市场" },
];

const LOOP_NODES = [
  { key: "beforeModel", title: "模型请求前（beforeModel）" },
  { key: "turnEnd", title: "回合结束（turnEnd）" },
  { key: "compact", title: "压缩前（compact）" },
] as const;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function cloneDoc(doc: OverridesFileParsed): OverridesFileParsed {
  return JSON.parse(JSON.stringify(doc)) as OverridesFileParsed;
}

export function CustomizationSection({ workspacePath }: { workspacePath?: string | null }) {
  const { customizationService, settingService } = useServices();
  const [scope, setScope] = useState<"user" | "workspace">("user");
  const [doc, setDoc] = useState<OverridesFileParsed>({ version: 1 });
  const [warning, setWarning] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canWorkspace = Boolean(workspacePath);

  const load = useCallback(async () => {
    if (!customizationService) return;
    if (scope === "workspace" && !canWorkspace) return;
    try {
      const snapshot = await customizationService.load({
        scope,
        ...(workspacePath ? { workspacePath } : {}),
      });
      setDoc(snapshot.overrides);
      setWarning(snapshot.warning ?? null);
      setError(null);
      setStatus("idle");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setStatus("error");
    }
  }, [customizationService, scope, workspacePath, canWorkspace]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void settingService
      .get()
      .then((settings) => {
        if (!cancelled) setMemoryEnabled(settings.memoryEnabled !== false);
      })
      .catch(() => {
        if (!cancelled) setMemoryEnabled(null);
      });
    return () => {
      cancelled = true;
    };
  }, [settingService]);

  const scheduleSave = useCallback(
    (next: OverridesFileParsed) => {
      setDoc(next);
      if (!customizationService) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void (async () => {
          setStatus("saving");
          try {
            await customizationService.save({
              scope,
              ...(workspacePath ? { workspacePath } : {}),
              overrides: next,
            });
            setStatus("saved");
            setWarning(null);
            setError(null);
          } catch (saveError) {
            setStatus("error");
            setError(saveError instanceof Error ? saveError.message : String(saveError));
          }
        })();
      }, 500);
    },
    [customizationService, scope, workspacePath],
  );

  const mutate = useCallback(
    (fn: (draft: OverridesFileParsed) => void) => {
      const next = cloneDoc(doc);
      fn(next);
      // 空对象清掉，保持文件干净可读。
      for (const key of Object.keys(next) as Array<keyof OverridesFileParsed>) {
        if (key === "version") continue;
        const value = next[key];
        if (value && typeof value === "object" && Object.keys(value).length === 0) {
          delete next[key];
        }
      }
      scheduleSave(next);
    },
    [doc, scheduleSave],
  );

  if (!customizationService) {
    return (
      <div className="space-y-4">
        <Alert variant="warning">
          <AlertDescription>当前 Host 未提供自定义服务（可能是远端连接），自定义中心暂不可用。</AlertDescription>
        </Alert>
      </div>
    );
  }

  const sections = doc.promptSections ?? {};
  const appends = doc.promptAppend ?? [];
  const hooks = doc.hooks ?? {};
  const env = Object.entries(doc.env ?? {});
  const panelsDisabled = doc.panels?.disabled ?? [];
  const panelOrder = doc.panels?.order ?? PANEL_IDS.map((p) => p.id);

  return (
    <div className="space-y-8 pb-16">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <Button
            size="sm"
            variant={scope === "user" ? "default" : "ghost"}
            onClick={() => setScope("user")}
          >
            全局
          </Button>
          <Button
            size="sm"
            variant={scope === "workspace" ? "default" : "ghost"}
            disabled={!canWorkspace}
            onClick={() => setScope("workspace")}
          >
            工作区
          </Button>
        </div>
        <span className="text-ui-sm text-foreground-subtle">
          {scope === "user" ? "~/.xbuild/custom/overrides.json" : "<工作区>/.zcode/custom/overrides.json"}
        </span>
        <span className="ml-auto text-ui-sm text-foreground-subtle">
          {status === "saving" ? "保存中…" : status === "saved" ? "已保存" : status === "error" ? "保存失败" : ""}
        </span>
        <Button size="sm" variant="outline" onClick={() => scheduleSave({ version: 1 })}>
          恢复默认
        </Button>
      </header>

      {warning ? (
        <Alert variant="warning">
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="warning">
          <AlertDescription>保存失败：{error}</AlertDescription>
        </Alert>
      ) : null}

      <Group title="提示词">
        <p className="text-ui-sm text-foreground-subtle">
          逐段启用/替换系统提示词。「替换」留空则使用内置内容；token 为估算值。
        </p>
        <div className="space-y-2">
          {BUILTIN_PROMPT_SECTIONS.map(({ source, title }) => {
            const override = sections[source] ?? {};
            const enabled = override.enabled !== false;
            const replace = override.replace ?? "";
            const builtinTokens = "—";
            return (
              <details key={source} className="rounded-lg border border-border px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      mutate((draft) => {
                        const next = { ...(draft.promptSections?.[source] ?? {}) };
                        next.enabled = checked;
                        if (next.enabled && next.replace === undefined) {
                          delete next.enabled; // 与默认一致时不写文件
                        }
                        draft.promptSections = { ...(draft.promptSections ?? {}), [source]: next };
                      })
                    }
                  />
                  <span className={enabled ? "text-ui-base" : "text-ui-base line-through opacity-50"}>
                    {title}
                  </span>
                  <Badge variant="outline" className="ml-auto font-mono text-ui-xs">
                    {replace ? `≈${estimateTokens(replace)} tokens（替换）` : `内置 ${builtinTokens}`}
                  </Badge>
                </summary>
                <div className="mt-2 space-y-2">
                  <Label className="text-ui-sm">整段替换（留空使用内置）</Label>
                  <Textarea
                    className="min-h-24 font-mono text-ui-sm"
                    value={replace}
                    onChange={(event) =>
                      mutate((draft) => {
                        const next = { ...(draft.promptSections?.[source] ?? {}) };
                        if (event.target.value) next.replace = event.target.value;
                        else delete next.replace;
                        draft.promptSections = { ...(draft.promptSections ?? {}), [source]: next };
                      })
                    }
                  />
                </div>
              </details>
            );
          })}
        </div>
      </Group>

      <Group title="追加段">
        <div className="space-y-2">
          {appends.map((entry, index) => (
            <AppendRow
              key={`${entry.id}-${index}`}
              entry={entry}
              onChange={(next) =>
                mutate((draft) => {
                  const list = [...(draft.promptAppend ?? [])];
                  list[index] = next;
                  draft.promptAppend = list;
                })
              }
              onRemove={() =>
                mutate((draft) => {
                  draft.promptAppend = (draft.promptAppend ?? []).filter((_, i) => i !== index);
                })
              }
            />
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              mutate((draft) => {
                const used = new Set((draft.promptAppend ?? []).map((a) => a.id));
                let id = "my-rules";
                let n = 2;
                while (used.has(id)) id = `my-rules-${n++}`;
                draft.promptAppend = [
                  ...(draft.promptAppend ?? []),
                  { id, title: "自定义规则", text: "" },
                ];
              })
            }
          >
            + 追加段
          </Button>
        </div>
      </Group>

      <Group title="循环">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="每回合最大步数（maxTurns）"
            value={doc.loop?.maxTurns}
            onChange={(value) =>
              mutate((draft) => {
                draft.loop = { ...(draft.loop ?? {}) };
                if (value === undefined) delete draft.loop.maxTurns;
                else draft.loop.maxTurns = value;
              })
            }
          />
          <NumberField
            label="每回合工具调用上限（maxToolCallsPerTurn）"
            value={doc.loop?.maxToolCallsPerTurn}
            onChange={(value) =>
              mutate((draft) => {
                draft.loop = { ...(draft.loop ?? {}) };
                if (value === undefined) delete draft.loop.maxToolCallsPerTurn;
                else draft.loop.maxToolCallsPerTurn = value;
              })
            }
          />
        </div>
        <div className="mt-4 space-y-4">
          {LOOP_NODES.map(({ key, title }) => (
            <div key={key} className="space-y-2">
              <Label className="text-ui-base">{title}</Label>
              {(hooks[key] ?? []).map((rule, index) => (
                <HookRuleRow
                  key={index}
                  rule={rule}
                  onChange={(next) =>
                    mutate((draft) => {
                      draft.hooks = { ...(draft.hooks ?? {}) };
                      const list = [...(draft.hooks[key] ?? [])];
                      list[index] = next;
                      draft.hooks[key] = list;
                    })
                  }
                  onRemove={() =>
                    mutate((draft) => {
                      draft.hooks = { ...(draft.hooks ?? {}) };
                      const list = (draft.hooks[key] ?? []).filter((_, i) => i !== index);
                      if (list.length === 0) delete draft.hooks[key];
                      else draft.hooks[key] = list;
                      if (Object.keys(draft.hooks).length === 0) delete draft.hooks;
                    })
                  }
                />
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  mutate((draft) => {
                    draft.hooks = { ...(draft.hooks ?? {}) };
                    draft.hooks[key] = [...(draft.hooks[key] ?? []), { inject: "" }];
                  })
                }
              >
                + 规则
              </Button>
            </div>
          ))}
        </div>
      </Group>

      <Group title="环境变量">
        <p className="text-ui-sm text-foreground-subtle">
          仅补充缺失的环境变量，不覆盖已存在的键。作用于 agent 子进程与工具。
        </p>
        <div className="space-y-2">
          {env.map(([key, value], index) => (
            <div key={`${key}-${index}`} className="flex items-center gap-2">
              <Input
                className="w-56 font-mono"
                value={key}
                onChange={(event) =>
                  mutate((draft) => {
                    const entries = Object.entries(draft.env ?? {});
                    entries[index] = [event.target.value, value];
                    draft.env = Object.fromEntries(entries);
                  })
                }
              />
              <Input
                className="flex-1 font-mono"
                value={value}
                onChange={(event) =>
                  mutate((draft) => {
                    const entries = Object.entries(draft.env ?? {});
                    entries[index] = [key, event.target.value];
                    draft.env = Object.fromEntries(entries);
                  })
                }
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  mutate((draft) => {
                    const entries = Object.entries(draft.env ?? {}).filter((_, i) => i !== index);
                    if (entries.length === 0) delete draft.env;
                    else draft.env = Object.fromEntries(entries);
                  })
                }
              >
                删除
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              mutate((draft) => {
                draft.env = { ...(draft.env ?? {}), "": "" };
              })
            }
          >
            + 变量
          </Button>
        </div>
      </Group>

      <Group title="面板">
        <div className="space-y-2">
          {panelOrder.map((panelId, index) => {
            const title = PANEL_IDS.find((p) => p.id === panelId)?.title ?? panelId;
            const disabled = panelsDisabled.includes(panelId);
            return (
              <div key={panelId} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <Switch
                  checked={!disabled}
                  onCheckedChange={(checked) =>
                    mutate((draft) => {
                      const current = new Set(draft.panels?.disabled ?? []);
                      if (checked) current.delete(panelId);
                      else current.add(panelId);
                      draft.panels = {
                        ...(draft.panels ?? {}),
                        disabled: [...current],
                      };
                    })
                  }
                />
                <span className={disabled ? "text-ui-base line-through opacity-50" : "text-ui-base"}>
                  {title}
                </span>
                <div className="ml-auto flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() =>
                      mutate((draft) => {
                        const order = [...panelOrder];
                        [order[index - 1], order[index]] = [order[index]!, order[index - 1]!];
                        draft.panels = { ...(draft.panels ?? {}), order };
                      })
                    }
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={index === panelOrder.length - 1}
                    onClick={() =>
                      mutate((draft) => {
                        const order = [...panelOrder];
                        [order[index], order[index + 1]] = [order[index + 1]!, order[index]!];
                        draft.panels = { ...(draft.panels ?? {}), order };
                      })
                    }
                  >
                    ↓
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Group>

      <Group title="功能">
        <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
          <Switch
            checked={memoryEnabled ?? false}
            disabled={memoryEnabled === null}
            onCheckedChange={(checked) => {
              setMemoryEnabled(checked);
              void settingService.update({ memoryEnabled: checked }).catch(() => {
                setMemoryEnabled((prev) => !prev);
              });
            }}
          />
          <div className="flex flex-col">
            <span className="text-ui-base">长期记忆（memory）</span>
            <span className="text-ui-sm text-foreground-subtle">读写现有设置键 memoryEnabled，不经 overrides.json。</span>
          </div>
        </div>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-ui-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-ui-sm">{label}</Label>
      <Input
        type="number"
        min={1}
        value={value ?? ""}
        placeholder="使用内置默认"
        onChange={(event) => {
          const raw = event.target.value.trim();
          if (!raw) {
            onChange(undefined);
            return;
          }
          const parsed = Number(raw);
          if (Number.isInteger(parsed) && parsed > 0) onChange(parsed);
        }}
      />
    </div>
  );
}

function AppendRow({
  entry,
  onChange,
  onRemove,
}: {
  entry: PromptAppendEntry;
  onChange: (next: PromptAppendEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <Input
          className="w-40 font-mono"
          value={entry.id}
          aria-label="段 id"
          onChange={(event) => onChange({ ...entry, id: event.target.value })}
        />
        <Input
          className="w-48"
          value={entry.title}
          aria-label="显示名"
          onChange={(event) => onChange({ ...entry, title: event.target.value })}
        />
        <Input
          className="w-44 font-mono"
          value={entry.after ?? ""}
          placeholder="锚点 source（可空）"
          aria-label="锚点"
          onChange={(event) => {
            const next: PromptAppendEntry = { ...entry };
            if (event.target.value) next.after = event.target.value;
            else delete (next as { after?: string }).after;
            onChange(next);
          }}
        />
        <span className="ml-auto text-ui-xs text-foreground-subtle">
          ≈{estimateTokens(entry.text)} tokens
        </span>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          删除
        </Button>
      </div>
      <Textarea
        className="min-h-20 font-mono text-ui-sm"
        value={entry.text}
        placeholder="追加到系统提示词的文本"
        onChange={(event) => onChange({ ...entry, text: event.target.value })}
      />
    </div>
  );
}

function HookRuleRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: HookRule;
  onChange: (next: HookRule) => void;
  onRemove: () => void;
}) {
  const isRun = rule.run !== undefined;
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isRun ? "default" : "outline"}
          onClick={() => {
            if (!isRun) onChange({ run: "", timeoutMs: 10000 });
          }}
        >
          脚本（run）
        </Button>
        <Button
          size="sm"
          variant={isRun ? "outline" : "default"}
          onClick={() => {
            if (isRun) onChange({ inject: "" });
          }}
        >
          注入（inject）
        </Button>
        {isRun ? (
          <>
            <Input
              className="flex-1 font-mono"
              value={rule.run ?? ""}
              placeholder="命令，如 ~/bin/my-hook.sh"
              onChange={(event) => onChange({ ...rule, run: event.target.value })}
            />
            <Input
              className="w-28"
              type="number"
              min={100}
              value={rule.timeoutMs ?? 10000}
              aria-label="timeoutMs"
              onChange={(event) => onChange({ ...rule, timeoutMs: Number(event.target.value) || 10000 })}
            />
          </>
        ) : (
          <Input
            className="flex-1"
            value={rule.inject ?? ""}
            placeholder="注入到本次请求的文本"
            onChange={(event) => onChange({ ...rule, inject: event.target.value })}
          />
        )}
        <Button size="sm" variant="ghost" onClick={onRemove}>
          删除
        </Button>
      </div>
    </div>
  );
}
