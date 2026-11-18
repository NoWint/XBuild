export { DshPluginsSection } from "./DshPluginsSection.js";
export { buildDshScope, useDshNativeUi } from "./useDshNativeUi.js";
export { useDshNativeUiStore, isDomainPending } from "./store.js";
export {
  canToggle,
  needsTrust,
  toCatalogRow,
  toDshCommand,
  trustChoiceFor,
} from "./contract.js";
export type {
  DshCatalogRow,
  DshCompatibilityLevel,
  DshDispatchPort,
  DshDomainState,
  DshManagementAction,
  DshNativeUiContract,
  DshTrustChoice,
} from "./contract.js";
export { dshNativeUiModule } from "./module.js";
