---
status: active
topics:
  - obsidian
  - theme
published: 2026-07-16
---

# Aera Theme Playground

中文排版与 English typography should feel balanced. This paragraph includes normal text, **bold text**, *italic text*, ==highlighted text==, and `inline code`.

## Links

Resolved link: [[Embedded Note]]
Unresolved link: [[Missing Note]]
External link: [Obsidian](https://obsidian.md)

### Lists and quote

> A blockquote for checking rhythm, borders, and muted text.

1. Ordered item
   1. Nested ordered item
2. Another ordered item

- Unordered item
  - Nested unordered item
- Another unordered item

- [x] Completed task
- [ ] Pending task

#### Code

```css
.aera-playground {
  color: var(--text-normal);
  background: var(--background-primary);
}
```

---

##### Callouts

> [!note] Note callout
> A calm piece of supporting information.

> [!warning] Warning callout
> Something here deserves closer attention.

###### Table, tags, embed, and footnote

| Element | State | Purpose |
| --- | --- | --- |
| Link | Resolved | Navigation |
| Task | Pending | Interaction |

#aera/theme #playground

![[Embedded Note]]

The playground ends with a footnote reference.[^aera]

[^aera]: Aera is a focused Obsidian theme fixture.
