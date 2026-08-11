import { Layers } from "lucide-react";
import { DockLabel } from "@/components/dock-label";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
	/** Groups waiting on an answer. */
	suggestions: number;
	/** Copies currently off screen. */
	hidden: number;
	showing: boolean;
	onToggleShowing: () => void;
	onReview: () => void;
};

/** Both halves in one control: suggestions waiting, and whether copies show. */
export function DuplicatesMenu({
	suggestions,
	hidden,
	showing,
	onToggleShowing,
	onReview,
}: Props) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						className="relative gap-0 px-2.5"
					/>
				}
				aria-label={
					suggestions > 0 ? `Duplicates, ${suggestions} waiting` : "Duplicates"
				}
			>
				<Layers />
				{/* Collapsed, the count has nowhere to sit, so the waiting work is a lit
				    lamp instead. It hands off to the real number as the label opens. */}
				{suggestions > 0 && (
					<span
						aria-hidden
						className="lamp absolute top-1 right-1 size-1.5 transition-opacity duration-150 ease-out [--lamp:var(--signal)] group-hover/button:opacity-0 group-focus-visible/button:opacity-0 group-aria-expanded/button:opacity-0"
					/>
				)}
				<DockLabel>
					Duplicates
					{suggestions > 0 ? (
						<span className="border border-border bg-background text-signal-ink inline-flex items-center justify-center rounded-chip px-1.5 py-0.5 leading-none font-data font-semibold tabular-nums">
							{suggestions}
						</span>
					) : (
						<span className="text-muted-foreground font-data tabular-nums">
							{hidden}
						</span>
					)}
				</DockLabel>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="top" align="end" className="w-72">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Duplicates</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem disabled={suggestions === 0} onClick={onReview}>
					<span className="flex-1">
						{suggestions === 0
							? "Nothing to review"
							: `Review ${suggestions} possible duplicate${
									suggestions === 1 ? "" : "s"
								}…`}
					</span>
				</DropdownMenuItem>
				<DropdownMenuCheckboxItem
					checked={showing}
					closeOnClick={false}
					onCheckedChange={onToggleShowing}
				>
					<span className="flex-1">Show the hidden copies</span>
					<span className="text-muted-foreground font-data tabular-nums">
						{hidden}
					</span>
				</DropdownMenuCheckboxItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
