import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Icon } from "../src/icons.jsx";
import sketchIcons from "../src/generated/code-editor/preview-sketch-icons.mjs";
import { Gear, Plus } from "@phosphor-icons/react";

test("XBuild renders shell and editor icons without proprietary icon fonts", () => {
  const markup = renderToStaticMarkup(React.createElement(Icon, { name: "Settings", weight: "strong" }));
  assert.equal(markup, renderToStaticMarkup(React.createElement(Gear, { weight: "bold", size: 16, "aria-hidden": true, "data-cds": "Icon", className: "" })));
  assert.doesNotMatch(markup, /Anthropicons|57344/);
  const add = renderToStaticMarkup(React.createElement(Icon, { name: "Add" }));
  const plus = renderToStaticMarkup(React.createElement(Plus));
  assert.match(add, /<svg/);
  assert.equal(add.replace(' data-cds="Icon"', ""), renderToStaticMarkup(React.createElement(Plus, { size: 16, "aria-hidden": true, className: "" })));
  assert.doesNotMatch(add, /Anthropicons/);
});

test("sketch toolbar has a visible vector fallback for each named icon", () => {
  for (const name of Object.keys(sketchIcons)) {
    const markup = renderToStaticMarkup(React.createElement(Icon, { name }));
    assert.match(markup, /<svg/, name);
  }
});
