import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ModelConfigSelect } from "@/ModelConfigSelect.js";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { TooltipProvider } from "@/components/ui/tooltip.js";
import "@/styles.css";

const params = new URLSearchParams(location.search);
document.documentElement.className =
  params.get("theme") === "light" ? "light theme-zai-light" : "dark theme-zai-dark";
const name =
  params.get("name") === "short"
    ? "GLM"
    : params.get("name") === "extreme"
      ? `GLM-${"LongModelName".repeat(20)}`
      : "GLM-5.3-Highspeed";
function Fixture() {
  const [selected, setSelected] = useState("text");
  const [effort, setEffort] = useState("low");
  const combined = params.get("combined") === "true";
  return (
    <ZCodeIntlProvider initialLocale="en-US">
      <TooltipProvider>
        <div className="p-8">
          <textarea
            id="composer-draft"
            defaultValue="Unsent draft"
            className="w-full text-mobile-input-safe"
          />
          <ModelConfigSelect
            modelGroups={[
              {
                key: "custom",
                label: "Custom provider",
                items: [
                  { key: "text", value: "text", name },
                  { key: "vision", value: "vision", name, supportsVisionInput: true },
                ],
              },
            ]}
            normalizedValue={selected}
            triggerLabel={combined ? name : "Models"}
            tooltipTitle={combined ? "Models" : undefined}
            labelVisibilityClassName="inline-flex"
            triggerIconClassName="inline-flex"
            composerOptions={
              combined
                ? {
                    providerLabel: "Provider",
                    modelsLabel: "Models",
                    effortLabel: "Effort",
                    selectModelLabel: "Select model",
                    levels: [
                      { value: "low", label: "Low" },
                      { value: "high", label: "High" },
                    ],
                    value: effort,
                    onValueChange: setEffort,
                  }
                : undefined
            }
            disabled={params.get("disabled") === "true"}
            showManageModelsAction={false}
            lockReasonMessage=""
            isItemLocked={() => false}
            onValueChange={setSelected}
            focusSelectorOnClose={combined ? "#composer-draft" : null}
            providerSubmenuClassName={
              innerWidth < 600
                ? "w-40 min-w-0 max-w-(--radix-dropdown-menu-content-available-width)"
                : undefined
            }
          />
          <output data-testid="selected">{selected}</output>
          <output data-testid="effort">{effort}</output>
        </div>
      </TooltipProvider>
    </ZCodeIntlProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
