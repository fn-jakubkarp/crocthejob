import { Gauge, Loader2, Plus, RotateCw } from "lucide-react";
import { BoardSearch } from "@/components/board-search";
import { ColumnsMenu } from "@/components/columns-menu";
import { DockLabel } from "@/components/dock-label";
import { DuplicatesMenu } from "@/components/duplicates-menu";
import { ThemeKey } from "@/components/theme-key";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import type { BoardData } from "@/hooks/use-board-data";
import type { BoardView } from "@/hooks/use-board-view";
import { cn } from "@/lib/utils";

const FITS = [
	{ id: "all", label: "Any fit" },
	{ id: "high", label: "High" },
	{ id: "medium", label: "Medium" },
	{ id: "low", label: "Low" },
];

type Props = {
	view: BoardView;
	data: BoardData;
	/** Whether a write is in flight. */
	saving: boolean;
	loading: boolean;
	onReload: () => void;
	onAdd: () => void;
	onReview: () => void;
};

/**
 * Every board control on one floating plate, centred and clear of the bottom edge.
 * There is no header: the board owns the full height and the dock rides over it.
 *
 * At rest the plate is a row of keys. Each one grows its own label when reached
 * for - see DockLabel - so the resting dock stays small enough to sit over the
 * board without competing with it.
 */
export function BoardDock({
	view,
	data,
	saving,
	loading,
	onReload,
	onAdd,
	onReview,
}: Props) {
	const fit = FITS.find((f) => f.id === view.fit) ?? FITS[0];

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-[100px] z-40 flex justify-center px-3">
			<div className="bg-popover elev-float pointer-events-auto relative flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-well p-1.5 duration-200 ease-out animate-in fade-in-0 slide-in-from-bottom-3">
				{/* Above the plate rather than in the row: a slot that is empty most of
				    the time would leave a permanent gap between the keys. */}
				<span
					aria-live="polite"
					className={cn(
						"text-muted-foreground pointer-events-none absolute -top-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5 font-data text-data transition-opacity duration-200 ease-out",
						!saving && "opacity-0",
					)}
				>
					<Loader2 className="size-3 animate-spin [animation-duration:0.7s]" />
					saving
				</span>

				<BoardSearch
					value={view.query}
					onChange={view.setQuery}
					total={data.onBoard.length}
					showing={data.filtered.length}
					countingEntries={view.showDupes}
				/>

				{/* A menu rather than a select, so the fit filter opens the same way
				    every other key on the plate does. */}
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button variant="outline" size="sm" className="gap-0 px-2.5" />
						}
						aria-label={`Fit filter, ${fit.label}`}
					>
						<Gauge />
						<DockLabel>{fit.label}</DockLabel>
					</DropdownMenuTrigger>
					<DropdownMenuContent side="top" align="start" className="w-44">
						<DropdownMenuGroup>
							<DropdownMenuLabel>Show which fit</DropdownMenuLabel>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuRadioGroup
							value={view.fit}
							onValueChange={(v) => view.setFit(v ?? "all")}
						>
							{FITS.map((f) => (
								<DropdownMenuRadioItem key={f.id} value={f.id}>
									{f.label}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>

				<Separator orientation="vertical" className="h-5" />

				<DuplicatesMenu
					suggestions={data.suggestions.length}
					hidden={data.hidden}
					showing={view.showDupes}
					onToggleShowing={view.toggleDupes}
					onReview={onReview}
				/>

				<ColumnsMenu
					visible={view.visible}
					totals={data.byColumn.totals}
					onToggle={view.toggleColumn}
					onShowAll={view.showAllColumns}
					onReset={view.resetColumns}
				/>

				<Separator orientation="vertical" className="h-5" />

				<Button
					variant="outline"
					size="sm"
					className="gap-0 px-2.5"
					onClick={onAdd}
					aria-label="Add a posting"
				>
					<Plus />
					<DockLabel>Add</DockLabel>
				</Button>

				<Button
					variant="outline"
					size="sm"
					className="gap-0 px-2.5"
					onClick={onReload}
					disabled={loading}
					aria-label="Reload the board"
				>
					{loading ? (
						<Loader2 className="animate-spin [animation-duration:0.7s]" />
					) : (
						<RotateCw />
					)}
					<DockLabel>Reload</DockLabel>
				</Button>

				<ThemeKey />
			</div>
		</div>
	);
}
