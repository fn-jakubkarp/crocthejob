import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { COLUMN_LABEL, columnOf, type Job, type Status } from "@/lib/jobs";
import { run, STATUS_HUE } from "@/lib/strip";
import { cn } from "@/lib/utils";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	job?: Job;
	count?: number;
	status?: Status;
	onConfirm: (date: string) => void;
};

export function StageDateDialog({
	open,
	onOpenChange,
	job,
	count,
	status,
	onConfirm,
}: Props) {
	const batch = typeof count === "number" && count > 1;
	const [date, setDate] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!open) return;
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, "0");
		const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		setDate(today);
	}, [open]);

	const confirm = () => {
		onConfirm(date);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{/* The dialog wears the move it is asking about: the hue of the column the
			    entry is in running into the hue of the one it is going to, along the
			    bottom edge - the same stroke the toast confirming the write will carry, so
			    the question and the answer are one object twice. A batch drops the first
			    hue, since the selection did not all come from one column. */}
			<DialogContent
				className={cn("sm:max-w-md", status && "hue-run")}
				style={
					status
						? run(
								STATUS_HUE[status],
								!batch && job ? STATUS_HUE[columnOf(job)] : undefined,
							)
						: undefined
				}
				initialFocus={() => inputRef.current}
			>
				<DialogHeader>
					<DialogTitle>
						{batch
							? `Move ${count} to ${status ? COLUMN_LABEL[status] : "stage"}`
							: `Move to ${status ? COLUMN_LABEL[status] : "stage"}`}
					</DialogTitle>
					<DialogDescription>
						{batch ? (
							<>When did these entries enter this stage?</>
						) : (
							<>
								{job?.company ?? "This posting"} -{" "}
								{job?.title?.replace(/\s+/g, " ").trim() || "untitled"}. When
								did it enter this stage?
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				<div>
					<p className="legend text-muted-foreground mb-1 text-legend">
						Since when?
					</p>
					<DatePicker
						value={date}
						onChange={setDate}
						className="w-full h-9 flex text-sm"
					/>
				</div>

				<DialogFooter>
					<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button size="sm" onClick={confirm}>
						{batch ? `Move ${count}` : "Move"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
