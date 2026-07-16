import postcss from "postcss";

export function declarationsFor(css, selector) {
  const declarations = new Map();
  const root = postcss.parse(css);

  root.walkRules((rule) => {
    if (rule.selector !== selector) return;

    for (const node of rule.nodes ?? []) {
      if (node.type === "decl") declarations.set(node.prop, node.value);
    }
  });

  return declarations;
}
