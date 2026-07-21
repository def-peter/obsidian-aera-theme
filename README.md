# Aera

A quiet interface for clear thinking.

Aera is an Obsidian theme for calm, readable Chinese-first notes with light,
dark, desktop, and mobile support.

![Aera screenshot](screenshot.png)

## Development

Run `npm install`, `npm run build`, and `npm run check`.

For live preview, set `AERA_TEST_VAULT` to a dedicated test vault, then run
`npm run link:vault` and `npm run dev`. The linker refuses to replace unknown
notes named `Theme Playground.md` or `Embedded Note.md`. Changes to
`manifest.json` require an Obsidian restart, while
compiled CSS automatically reloads in the linked vault.

## Release assets

Every release contains `manifest.json` and `theme.css`.

## License

Aera is available under the [MIT](LICENSE) License. Embedded third-party assets
are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
