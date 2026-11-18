import { parseArgs } from "node:util";
import { compareDesktopImages } from "./desktop-ui-visual-compare.mjs";

const HELP = `Usage:
  node scripts/compare-desktop-ui.mjs --reference ref.png --candidate xbuild.png --out-dir evidence/comparison

Required:
  --reference <path>                 Reference PNG (legally provided or test-generated)
  --candidate <path>                 Candidate PNG; pixel dimensions must match
  --out-dir <path>                   New or empty output directory; no overwrite

Optional:
  --reference-meta <path>            Reference capture metadata JSON
  --candidate-meta <path>            Candidate capture metadata JSON (must be paired)
  --threshold <number>               Normalized channel delta in [0,1], default 0.1
  --max-difference-ratio <number>    Allowed different/compared ratio, default 0.01
  --ignore <json>                    Array of {x,y,width,height,reason} rectangles
  --help                            Show help without reading/writing files

Metadata: viewport {width,height}, deviceScaleFactor, light/dark theme, and state
must match. State is a nonempty string or JSON object. Reference metadata must
include product, version, and source. viewport * deviceScaleFactor must round to
PNG dimensions. Verification covers only the supplied pair and declared state,
not capture authenticity, untested pages, animation, or app-wide equivalence.

Visible RGB deltas use the maximum over black/white compositing backgrounds.
A pixel differs only above threshold; ignored pixels are excluded from ratios.
Outputs: reference.png, candidate.png, overlay.png, difference.png,
comparison.json, and index.html with a local interactive overlay slider.
Success prints one JSON result. No metadata means unverified image comparison.
Exit codes: 0 matched, 1 different, 2 argument/metadata/input/IO error.
`;

function numericArgument(value, name) {
  if (value === undefined) return undefined;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
    throw new TypeError(`--${name} must be a finite decimal number in [0, 1]`);
  }
  return Number(value);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    process.stdout.write(HELP);
    return;
  }
  const { values, tokens } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    tokens: true,
    options: {
      reference: { type: "string" },
      candidate: { type: "string" },
      "out-dir": { type: "string" },
      "reference-meta": { type: "string" },
      "candidate-meta": { type: "string" },
      threshold: { type: "string" },
      "max-difference-ratio": { type: "string" },
      ignore: { type: "string" },
    },
  });
  const seen = new Set();
  for (const token of tokens) {
    if (token.kind !== "option") continue;
    if (seen.has(token.name))
      throw new Error(`--${token.name} must not be supplied more than once`);
    seen.add(token.name);
  }
  const result = await compareDesktopImages({
    referencePath: values.reference,
    candidatePath: values.candidate,
    outputDirectory: values["out-dir"],
    referenceMetadataPath: values["reference-meta"],
    candidateMetadataPath: values["candidate-meta"],
    threshold: numericArgument(values.threshold, "threshold"),
    maxDifferenceRatio: numericArgument(values["max-difference-ratio"], "max-difference-ratio"),
    ignore: values.ignore === undefined ? undefined : JSON.parse(values.ignore),
  });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exitCode = result.status === "matched" ? 0 : 1;
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `desktop-ui-compare: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
