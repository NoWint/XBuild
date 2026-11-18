import type { DshController } from "./contract.js";

export function exampleDshOverview(controller: DshController, workspacePath: string) {
  return controller.dispatch({ scope: { workspacePath }, command: { kind: "overview" } });
}
