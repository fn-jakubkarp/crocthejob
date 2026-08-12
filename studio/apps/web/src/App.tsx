import { useEffect, useState } from "react";
import { AppRail, type Section } from "@/components/app-rail";
import { Board } from "@/components/board";
import { BoardDialogs } from "@/components/board-dialogs";
import { BoardDock } from "@/components/board-dock";
import { DocsPage } from "@/components/docs";
import { HistoryPage } from "@/components/history-page";
import { JobPage } from "@/components/job-page";
import { SchemaDialog } from "@/components/schema-dialog";
import { SelectionBar } from "@/components/selection-bar";
import { SetupIntake } from "@/components/setup/intake";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { StatsPage } from "@/components/stats-page";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBoardData } from "@/hooks/use-board-data";
import { useBoardView } from "@/hooks/use-board-view";
import { useDialogs } from "@/hooks/use-dialogs";
import { useJobActions } from "@/hooks/use-job-actions";
import { useJobs } from "@/hooks/use-jobs";
import { useRun } from "@/hooks/use-run";
import { useSelection } from "@/hooks/use-selection";
import { useSetup } from "@/hooks/use-setup";
import { useShortcuts } from "@/hooks/use-shortcuts";
import type { Status } from "@/lib/jobs";

/**
 * The app, assembled. One concern per layer: `useJobs` the list and its writes,
 * `useBoardView` the view state, `useBoardData` what the columns render,
 * `useJobActions` what a card can ask for.
 */
export default function App() {
	const store = useJobs();
	const view = useBoardView();
	const data = useBoardData(store.jobs, view);
	const selection = useSelection(data.byColumn.map);
	const { actions, flow } = useJobActions(store, selection);
	const dialogs = useDialogs();
	const { setup, save } = useSetup();
	// Mounted here, not on the job page: `/api/run` kills the child when the request
	// closes, so walking back to the board mid-`/apply` would kill the run with it.
	const run = useRun(store.reload);

	const [section, setSection] = useState<Section>("board");
	// The intake sheet takes the whole window, once, on the run where nobody has seen
	// it - a first run that reappears every launch until finished is a nag. After that
	// the rail is the way back in, to the same sheet as a section of the app.
	const [firstRun, setFirstRun] = useState(!setup.seen);
	// A column the stats page asked for, held until the board has rendered it.
	const [focus, setFocus] = useState<Status | null>(null);
	// The entry the job page is on, by `id` rather than by key: correcting a URL
	// re-keys the entry, and the id is the one handle that is assigned once and never
	// reused. See PRODUCT.md.
	const [openId, setOpenId] = useState<number | null>(null);
	const [helping, setHelping] = useState(false);
	const [schema, setSchema] = useState(false);

	useEffect(() => {
		if (!setup.seen) save({ seen: true });
	}, [setup.seen, save]);

	const open =
		openId === null ? undefined : store.jobs.find((j) => j.id === openId);
	// An entry that has gone - deleted, or the list reloaded without it - leaves the
	// page rather than rendering an empty one.
	const current = section !== "job" || open ? section : "board";

	/**
	 * The board's own keys are handed over only while the board is up: `r` on the stats
	 * page reloading a board nobody is looking at, or `/` reaching for a filter field that
	 * is not mounted, are both worse than the key doing nothing. See `use-shortcuts`.
	 */
	useShortcuts(
		// Nothing on the board is on screen during the first run, and its keys reach
		// past the sheet into it: `r` reloads a board nobody is looking at, `/` reaches
		// for a filter field that is not mounted.
		firstRun
			? {}
			: {
					help: () => setHelping(true),
					board: () => setSection("board"),
					stats: () => setSection("stats"),
					history: () => setSection("history"),
					docs: () => setSection("docs"),
					// Only from a job page: everywhere else Escape belongs to whatever
					// took the keyboard, and `use-shortcuts` stands down for those anyway.
					...(current === "job" && { back: () => setSection("board") }),
					...(current === "board" && {
						search: () => document.getElementById("board-search")?.focus(),
						add: dialogs.openAdd,
						reload: () => void store.reload(),
						columnsAll: view.showAllColumns,
						columnsReset: view.resetColumns,
					}),
				},
	);

	useEffect(() => {
		if (!focus) return;
		setFocus(null);
		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		document.getElementById(`column-${focus}`)?.scrollIntoView({
			behavior: reduced ? "auto" : "smooth",
			inline: "center",
			block: "nearest",
		});
	}, [focus]);

	/** One entry, at full size. The card's plain click still opens the popover. */
	const openJob = (id: number) => {
		setOpenId(id);
		setSection("job");
	};

	/**
	 * A reading on the stats page, opened as the column it counted - filtered to one
	 * posting when the reading was about one, since a row naming a company is not worth
	 * much if it lands you in a column of 143.
	 */
	const openColumn = (status: Status, query?: string) => {
		view.setQuery(query ?? "");
		view.showColumn(status);
		setSection("board");
		setFocus(status);
	};

	// The whole window, and nothing of the board behind it: this is the one screen
	// where there is nothing yet to look at.
	if (firstRun)
		return (
			<>
				<SetupIntake
					view={view}
					counts={data.byColumn.totals}
					onImported={() => void store.reload()}
					onLater={() => setFirstRun(false)}
					onDone={() => setFirstRun(false)}
				/>
				<Toaster position="bottom-right" />
			</>
		);

	return (
		<TooltipProvider>
			<div className="flex h-screen flex-col">
				<AppRail
					section={current}
					onSection={setSection}
					onHelp={() => setHelping(true)}
					onSetup={() => setSection("setup")}
					onSchema={() => setSchema(true)}
				/>

				{store.error && (
					<div className="text-destructive m-4 ml-rail rounded-key bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))] px-3 py-2.5 text-body shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--destructive)_35%,transparent)]">
						<span className="label mr-2 text-legend">Read failed</span>
						{store.error}
					</div>
				)}

				{current === "job" && open ? (
					<JobPage
						job={open}
						onBack={() => setSection("board")}
						onStatus={(status) => actions.changeStatus(open.key, status)}
						onNotes={(notes) => actions.changeNotes(open.key, notes)}
						onPatch={(changes) => actions.patch(open.key, changes)}
						// Corrections made in place go the dialog's own way, so a re-key
						// from a fixed URL is followed rather than losing the entry.
						onSaveEdits={(changes) => {
							void actions.saveEdits(open.key, changes).catch(() => {});
						}}
						onOutcome={(tag) => actions.toggleOutcome(open.key, tag)}
						onClearOutcome={() => actions.clearOutcome(open.key)}
						onSavePosting={actions.savePosting}
						run={run}
					/>
				) : current === "setup" ? (
					// The same sheet the first run is, with the rail beside it. It was a
					// dialog holding the same four sections one at a time, which meant the
					// screen everybody learns setup on was not the screen they ever saw
					// again.
					<SetupIntake
						embedded
						view={view}
						counts={data.byColumn.totals}
						onImported={() => void store.reload()}
						onLater={() => setSection("board")}
						onDone={() => setSection("board")}
					/>
				) : current === "docs" ? (
					<DocsPage />
				) : current === "stats" ? (
					<StatsPage
						jobs={store.jobs}
						dupes={data.dupes}
						onOpen={openColumn}
						onOutcome={actions.toggleOutcome}
						onStatus={actions.changeStatus}
					/>
				) : current === "history" ? (
					<HistoryPage
						jobs={store.jobs}
						dupes={data.dupes}
						onOpen={openColumn}
					/>
				) : (
					<>
						{/* The board, and everything that only acts on it. */}
						<h1 className="sr-only">Croc the Job</h1>

						<Board
							view={view}
							data={data}
							actions={actions}
							selection={selection}
							dialogs={dialogs}
							onOpenJob={openJob}
						/>

						<BoardDock
							view={view}
							data={data}
							saving={store.saving > 0}
							loading={store.loading}
							onReload={() => void store.reload()}
							onAdd={dialogs.openAdd}
							onReview={() => dialogs.setReviewing(true)}
						/>

						{selection.count > 0 && (
							<SelectionBar
								count={selection.count}
								onMove={actions.batchStatus}
								onDismiss={() => dialogs.setDismissing(true)}
								onClear={selection.clear}
								onOutcome={actions.batchOutcome}
							/>
						)}
					</>
				)}

				<BoardDialogs
					jobs={store.jobs}
					dialogs={dialogs}
					flow={flow}
					actions={actions}
					store={store}
					suggestions={data.suggestions}
					selected={selection.count}
				/>

				<ShortcutsDialog open={helping} onOpenChange={setHelping} />

				<SchemaDialog open={schema} onOpenChange={setSchema} />

				<Toaster position="bottom-right" />
			</div>
		</TooltipProvider>
	);
}
