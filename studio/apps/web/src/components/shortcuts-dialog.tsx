import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { caps, GROUPS, SHORTCUTS } from "@/lib/shortcuts";

/**
 * The shortcut table, printed. Nothing is listed here by hand: the rows come from
 * SHORTCUTS, which is what the listener matches against, so the panel cannot document a
 * key that does not work or miss one that does.
 *
 * A cap is the board's own chip at keyboard scale - flat, hairlined, on the surface
 * plane, in the data face, since a keycap is a literal value and not a label.
 */

/** ⌘ or Ctrl. Read once at module load; nobody changes platform mid-session. */
const MAC =
	typeof navigator !== "undefined" &&
	/Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * A cap reads at the same size as the label beside it, in full ink rather than second:
 * same rung, more weight. Above that it starts to shout across the row, below it you
 * squint at the one thing on the row you came for.
 *
 * The height is fixed rather than padded to fit, so `⌘` and `N` are the same box.
 * `rounded-key` and not `rounded-chip` - at 24px a 4px corner is a square with the
 * corners filed off.
 */
function Cap({ children }: { children: string }) {
	return (
		<kbd className="text-foreground bg-surface inline-flex h-6 min-w-6 items-center justify-center rounded-key px-1.5 font-data text-body leading-none shadow-[inset_0_0_0_1px_var(--border-strong)]">
			{children}
		</kbd>
	);
}

export function ShortcutsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-3.5 sm:max-w-md">
				<DialogHeader className="gap-1">
					<DialogTitle>Keyboard</DialogTitle>
					<DialogDescription>
						The board keys act on the board, so they wait until it is the
						section you are in. Nothing fires while you are typing or while a
						dialog is up.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3.5">
					{GROUPS.map((group) => (
						<div key={group}>
							<span className="legend text-muted-foreground mb-1.5 block text-legend">
								{group}
							</span>
							<dl className="flex flex-col">
								{SHORTCUTS.filter((s) => s.group === group).map((s) => (
									<div
										key={s.id}
										className="flex items-center gap-3 border-b border-border py-1 last:border-0"
									>
										<dt className="text-ink-2 min-w-0 flex-1">{s.label}</dt>
										{/* Two combos read as one alternative, not two rows: the
										    "or" is the whole point of offering both. */}
										<dd className="flex shrink-0 items-center gap-1.5">
											{s.combos.map((combo, i) => (
												<span key={combo} className="flex items-center gap-1">
													{i > 0 && (
														<span className="text-muted-foreground mr-0.5 text-meta">
															or
														</span>
													)}
													{caps(combo, MAC).map((cap) => (
														<Cap key={cap}>{cap}</Cap>
													))}
												</span>
											))}
										</dd>
									</div>
								))}
							</dl>
						</div>
					))}

					{/* Not in the table because nothing binds it: Escape is the browser's and
					    every layer already answers it. Worth printing all the same. */}
					<div>
						<span className="legend text-muted-foreground mb-1.5 block text-legend">
							Also
						</span>
						<div className="flex items-center gap-3 py-1">
							<span className="text-ink-2 min-w-0 flex-1">
								Close what is open, clear the filter, drop the selection
							</span>
							<Cap>Esc</Cap>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
