# Hardware Integration Diagram Assets

Files:

- `hardware-integration-diagram.mmd`: editable Mermaid source for the hardware integration system diagram.
- `hardware-integration-diagram.svg`: rendered SVG for docs, app handoff notes, or import into design tools.
- `hardware-integration-diagram.pdf`: optional print/deck output when needed.

Render locally with Mermaid CLI:

```bash
npx --yes @mermaid-js/mermaid-cli \
  -i apps/field-android/docs/v2-product/diagrams/hardware-integration-diagram.mmd \
  -o apps/field-android/docs/v2-product/diagrams/hardware-integration-diagram.svg

npx --yes @mermaid-js/mermaid-cli \
  -i apps/field-android/docs/v2-product/diagrams/hardware-integration-diagram.mmd \
  -o apps/field-android/docs/v2-product/diagrams/hardware-integration-diagram.pdf
```

Polishing workflow:

- Keep Mermaid as the source-controlled architecture format.
- Use the generated SVG for Markdown and product documentation.
- Import the SVG into Figma, Illustrator, or diagrams.net when a presentation-grade visual needs manual spacing, typography, or brand polish.
- If a design-tool version becomes the presentation source, keep the `.mmd` aligned with any structural changes.
