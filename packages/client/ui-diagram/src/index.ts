/**
 * Web diagram card plugin, node half.
 *
 * Deliberately empty: the tool itself is composed per agent preset
 * (`@deepseek-ai/dsh-diagram`), while this package only owns the browser-side
 * card that renders `diagram` tool calls. Nothing model-facing registers here.
 */

/** Host plugin body — the browser half owns the diagram card. */
export function apply(): void {}
