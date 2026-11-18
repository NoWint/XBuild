import type { DshDomain, DshJson } from "./contract.js";

export async function inspectAndCloseDshDomain(domain: DshDomain): Promise<DshJson> {
  try {
    return await domain.request({ kind: "plugins" });
  } finally {
    await domain.stop();
  }
}
