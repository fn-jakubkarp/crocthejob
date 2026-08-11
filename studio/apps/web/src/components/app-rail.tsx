import {
	ChartColumn,
	Files,
	History,
	Keyboard,
	MessageSquare,
	SquareKanban,
} from "lucide-react";
import { DockLabel } from "@/components/dock-label";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Section = "board" | "stats" | "history" | "chat" | "docs";

const KEYS = [
	{ id: "board", label: "Board", icon: SquareKanban },
	{ id: "stats", label: "Stats", icon: ChartColumn },
	{ id: "history", label: "History", icon: History },
	{ id: "chat", label: "Chat", icon: MessageSquare },
	{ id: "docs", label: "Docs", icon: Files },
] as const satisfies readonly { id: Section; label: string; icon: unknown }[];

/**
 * Section navigation: a gutter flush to three edges, on the surface plane with a
 * single hairline down its one visible side. No radius, no shadow - the tone step
 * and the rule are the whole separation, and a column scrolled behind it passes
 * cleanly under an opaque edge.
 *
 * Fixed rather than a flex sibling of the content, for the same reason the dock
 * floats: a key that grows a label on hover would otherwise shove the whole page
 * sideways. The content pays for it with a fixed left padding instead.
 *
 * One group for every key: reaching for one opens all the labels, so the rail is
 * never half a word wide with a bare glyph under it. `w-fit` lets the channel widen
 * with them; the padding is what centres the glyphs in it while they are shut.
 */
export function AppRail({
	section,
	onSection,
	onHelp,
}: {
	section: Section;
	onSection: (section: Section) => void;
	/** Opens the shortcut panel. Bottom of the rail, clear of the section keys. */
	onHelp: () => void;
}) {
	return (
		<nav
			aria-label="Sections"
			className="group/rail bg-surface fixed inset-y-0 left-0 z-40 flex w-fit flex-col gap-1 border-r border-border p-2 duration-200 ease-out animate-in fade-in-0 slide-in-from-left-3 motion-reduce:animate-none"
		>
			{/* The mark, not a key: nothing to press, no hover state, no `aria-current`.
			    It sits in the same glyph column as the sections and opens its wordmark
			    on the rail's own group, so the gutter reads as one object rather than a
			    logo parked above a nav. Ink, not signal, for the reason the keys are:
			    a permanently lit accent would flatten selection, focus and the drop
			    target.

			    Drawn at 28px because the gator stops holding below that, but laid out
			    as the 14px glyph the section keys use. `--spacing-rail` is a fixed
			    inset the board pays as `pl-rail`, so a wider key here would not widen
			    the gutter, it would slide the rail out over the first column. The
			    negative margin is what keeps the drawing bigger than its slot. */}
			<div className="mb-1 flex h-8 items-center px-2.5">
				<Mark className="text-foreground -mx-[7px] size-7" />
				<DockLabel>
					<span className="label text-meta text-foreground">Croc the Job</span>
				</DockLabel>
			</div>

			{KEYS.map(({ id, label, icon: Icon }) => {
				const current = section === id;
				return (
					<Button
						key={id}
						variant="ghost"
						// The section you are in is the one filled and edged, and it holds
						// that state under the pointer. Every other key is ink only until
						// reached for. No accent here: signal is spent on selection, focus
						// and the drop target, and a permanently lit nav item would make
						// those three read as ordinary.
						className={cn(
							"text-muted-foreground justify-start gap-0 px-2.5 hover:bg-card hover:text-foreground",
							current &&
								"bg-card text-foreground border-border hover:bg-card hover:border-border",
						)}
						size="sm"
						aria-current={current ? "page" : undefined}
						aria-label={label}
						onClick={() => onSection(id)}
					>
						<Icon />
						<DockLabel>{label}</DockLabel>
					</Button>
				);
			})}

			{/* `mt-auto` and no rule: the gap to the section keys is the separation, and a
			    hairline across a two-glyph-wide gutter reads as a broken edge. Not a
			    section, so no `aria-current` and no filled state - it opens a panel and
			    hands focus straight back. */}
			<Button
				variant="ghost"
				className="text-muted-foreground mt-auto justify-start gap-0 px-2.5 hover:bg-card hover:text-foreground"
				size="sm"
				aria-label="Keyboard shortcuts"
				onClick={onHelp}
			>
				<Keyboard />
				<DockLabel>Shortcuts</DockLabel>
			</Button>
		</nav>
	);
}
