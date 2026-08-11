import { Columns3 } from "lucide-react";
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
import { COLUMNS, type Status } from "@/lib/jobs";

type Props = {
	visible: Status[];
	/** Each column's population, so the menu says what bringing one back gets you. */
	totals: Map<Status, number>;
	onToggle: (status: Status) => void;
	onShowAll: () => void;
	onReset: () => void;
};

export function ColumnsMenu({
	visible,
	totals,
	onToggle,
	onShowAll,
	onReset,
}: Props) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="outline" size="sm" className="gap-0 px-2.5" />}
				aria-label="Columns"
			>
				<Columns3 />
				<DockLabel>
					Columns
					<span className="text-muted-foreground font-data tabular-nums">
						{visible.length}/{COLUMNS.length}
					</span>
				</DockLabel>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="top" align="end" className="w-60">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Visible columns</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				{COLUMNS.map((col) => (
					<DropdownMenuCheckboxItem
						key={col.status}
						checked={visible.includes(col.status)}
						// Stays open, so several columns toggle in one visit.
						closeOnClick={false}
						onCheckedChange={() => onToggle(col.status)}
					>
						<span className="flex-1">{col.label}</span>
						<span className="text-muted-foreground font-data tabular-nums">
							{totals.get(col.status) ?? 0}
						</span>
					</DropdownMenuCheckboxItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem closeOnClick={false} onClick={onShowAll}>
					Show all
				</DropdownMenuItem>
				<DropdownMenuItem closeOnClick={false} onClick={onReset}>
					Reset to default
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
