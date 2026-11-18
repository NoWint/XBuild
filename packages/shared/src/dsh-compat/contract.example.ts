import { dshDispatchSchema, type DshDispatch } from "./contract.js";

export function exampleDshOverview(workspacePath: string): DshDispatch {
  return dshDispatchSchema.parse({ scope: { workspacePath }, command: { kind: "overview" } });
}
