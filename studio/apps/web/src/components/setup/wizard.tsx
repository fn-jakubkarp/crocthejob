import { useMemo } from "react";
import { toast } from "sonner";
import { SetupDocuments } from "@/components/setup/documents";
import { sectionsFor } from "@/components/setup/sections";
import {
	BoardStep,
	Chip,
	ImportStep,
	ModeStep,
} from "@/components/setup/steps";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { BoardView } from "@/hooks/use-board-view";
import { useSetup } from "@/hooks/use-setup";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The dialog sets the board's own defaults through it, rather than shadowing them. */
	view: BoardView;
	/** After an import lands, so the board shows what arrived. */
	onImported: () => void;
};

/**
 * Settings, and the way back into a first run that was walked out of. The same four
 * sections the intake sheet carries, in the shape a settings panel wants: one at a
 * time, over the board it is about, with the steps as a strip you can move around in
 * rather than a run you can only walk forwards through.
 *
 * It stores almost nothing itself. The plate belongs to next-themes, the columns and
 * filters to the board's view, the documents to the repo; this writes those and keeps
 * only which mode this is and how far the run got. See `use-setup`.
 */
export function SetupWizard({ open, onOpenChange, view, onImported }: Props) {
	const { setup, save } = useSetup();
	const sections = useMemo(() => sectionsFor(setup.ai), [setup.ai]);

	const index = Math.min(setup.step, sections.length - 1);
	const section = sections[index];
	const last = index === sections.length - 1;

	const go = (next: number) =>
		save({ step: Math.max(0, Math.min(sections.length - 1, next)) });

	const finish = () => {
		save({ done: true, step: 0 });
		onOpenChange(false);
		toast.success("Setup saved", {
			description: "Reopen it any time from the bottom of the rail.",
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-3.5 sm:max-w-lg">
				<DialogHeader className="gap-1">
					<DialogTitle>{setup.done ? "Setup" : "Finish setup"}</DialogTitle>
					<DialogDescription>{section.line}</DialogDescription>
				</DialogHeader>

				{/* The sections as a strip rather than a counter: this is the settings
				    navigation, and a wizard you can only walk forwards through is no use
				    as one. */}
				<div className="flex flex-wrap gap-1.5">
					{sections.map((entry, i) => (
						<Chip key={entry.id} on={i === index} onClick={() => go(i)}>
							<span className="text-muted-foreground font-data tabular-nums">
								{i + 1}
							</span>
							{entry.label}
						</Chip>
					))}
				</div>

				{/* No floor: the documents section is taller than any of them, so a height
				    that holds still between the other three buys nothing but a hand of
				    empty plate under Mode. */}
				<div>
					{section.id === "mode" && <ModeStep view={view} />}
					{section.id === "board" && <BoardStep view={view} />}
					{section.id === "import" && <ImportStep onImported={onImported} />}
					{section.id === "docs" && <SetupDocuments />}
				</div>

				<DialogFooter className="sm:justify-between">
					<Button
						variant="ghost"
						size="sm"
						disabled={index === 0}
						onClick={() => go(index - 1)}
					>
						Back
					</Button>
					<div className="flex gap-2">
						{/* Leaving unfinished is a real answer: the rail carries the way back
						    in until every section has been through. */}
						{!setup.done && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onOpenChange(false)}
							>
								Later
							</Button>
						)}
						{last ? (
							<Button size="sm" onClick={finish}>
								{setup.done ? "Done" : "Finish"}
							</Button>
						) : (
							<Button size="sm" onClick={() => go(index + 1)}>
								Next
							</Button>
						)}
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
