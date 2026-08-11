import { Ban, X } from "lucide-react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
	COLUMNS,
	OUTCOME_GROUPS,
	OUTCOMES_BY_GROUP,
	type OutcomeId,
	type Status,
} from "@/lib/jobs";

type Props = {
	count: number;
	onMove: (status: Status) => void;
	onDismiss: () => void;
	onClear: () => void;
	/** Moves the whole selection to Rejected carrying this one tag. */
	onOutcome: (tag: OutcomeId) => void;
};

/** Mounted only while something is selected. */
export function SelectionBar({
	count,
	onMove,
	onDismiss,
	onClear,
	onOutcome,
}: Props) {
	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center">
			<div className="bg-popover elev-float pointer-events-auto flex items-center gap-2 rounded-well px-2 py-1.5 duration-150 ease-out animate-in fade-in-0 slide-in-from-bottom-2">
				<span className="pl-1.5 text-body font-medium tabular-nums">
					{count} selected
				</span>

				<Separator orientation="vertical" className="h-5" />

				<DropdownMenu>
					<DropdownMenuTrigger render={<Button variant="outline" size="xs" />}>
						Move to
					</DropdownMenuTrigger>
					<DropdownMenuContent align="center" side="top" className="w-auto">
						{COLUMNS.map((col) => (
							<DropdownMenuItem
								key={col.status}
								onClick={() => onMove(col.status)}
							>
								{col.label}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Rejected + tag in one write. Exists for the 41 already-ghosted entries. */}
				<DropdownMenu>
					<DropdownMenuTrigger render={<Button variant="outline" size="xs" />}>
						Outcome
					</DropdownMenuTrigger>
					<DropdownMenuContent align="center" side="top" className="w-auto">
						{OUTCOME_GROUPS.map((group, i) => (
							<Fragment key={group.id}>
								{i > 0 && <DropdownMenuSeparator />}
								<DropdownMenuGroup>
									<DropdownMenuLabel>{group.label}</DropdownMenuLabel>
								</DropdownMenuGroup>
								{OUTCOMES_BY_GROUP[group.id].map((tag) => (
									<DropdownMenuItem
										key={tag.id}
										onClick={() => onOutcome(tag.id)}
									>
										{tag.label}
									</DropdownMenuItem>
								))}
							</Fragment>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				<Button variant="outline" size="xs" onClick={onDismiss}>
					<Ban />
					Skip with a reason…
				</Button>

				<Separator orientation="vertical" className="h-5" />

				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onClear}
					aria-label="Clear the selection"
				>
					<X />
				</Button>
			</div>
		</div>
	);
}
