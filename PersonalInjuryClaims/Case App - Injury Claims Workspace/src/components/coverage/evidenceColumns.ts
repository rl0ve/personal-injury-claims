/**
 * THE EVIDENCE LIST'S TWO CONTROL COLUMNS — and the widths are measured, not guessed.
 *
 * Both controls were content-sized (`width={0}`) inside a right-anchored cluster,
 * on the argument that the right anchor made the resizing safe. It only holds the
 * LAST control's right edge. Measured on the running page, the three rows' Relevance
 * triggers started at 847 / 868 / 851 — a 21px spread, so nothing lined up down the
 * list — and picking "Not relevant" widened that control by 45px and dragged it 45px
 * left while its neighbour stayed put.
 *
 * So each column is a fixed cell and the control is right-aligned inside it. The
 * column edges cannot move, whatever is selected, and every row's chevron lands on
 * the same pixel.
 *
 * The widths are the widest value each control can hold, measured against the live
 * trigger at its own 12px: "Not relevant" is 130px and "Partially approve" is 155px.
 * The few px on top absorb font-rounding — a column narrower than its longest value
 * would let a `whitespace-nowrap` trigger spill out of it.
 *
 * Written as whole literal class strings because Tailwind finds classes by scanning
 * this file as text; a computed `w-[…]` would emit nothing.
 *
 * ## Why this is its own module
 *
 * Three things have to agree on these edges: the column headings in the band, every
 * row, and the composer's own line (./EvidenceComposer.tsx — the form is a row being
 * written, so its two selects sit in the same columns the finished row's will). The
 * list already imports the composer, so the constants cannot live in the list without
 * a cycle, and they are not primitives — they are these columns. Hence a two-export
 * file that both import.
 */
export const COL = {
  relevance: "w-[136px]",
  decision: "w-[160px]",
} as const;

/**
 * What each column is for. The same sentences the triggers carry, so hovering
 * either the heading or the control answers the same question.
 */
export const COL_HINT = {
  relevance: "How much weight this evidence carries in the decision.",
  decision: "What this evidence argues for on its own.",
} as const;
