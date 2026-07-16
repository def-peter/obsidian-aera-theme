import assert from "node:assert/strict";
import test from "node:test";

import { declarationsFor } from "./css.mjs";

test("declarationsFor ignores declarations in nested child rules", () => {
  const css = `
    body {
      --font-text-theme: parent;

      .child {
        --font-text-theme: child;
      }
    }
  `;

  assert.equal(declarationsFor(css, "body").get("--font-text-theme"), "parent");
});
