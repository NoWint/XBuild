export { DshPluginsSection } from "./DshPluginsSection.js";
export { DshNativeSurface } from "./DshNativeSurface.js";
export { createDshNativeClient } from "./native-client.js";
export {
  attachDshNativeTransport,
  fetchNativeBytes,
  collectNativeStream,
} from "./native-transport.js";
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
