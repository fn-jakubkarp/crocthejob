import { useEffect, useState } from "react";
import { AppRail, type Section } from "@/components/app-rail";
import { Board } from "@/components/board";
import { BoardDialogs } from "@/components/board-dialogs";
import { BoardDock } from "@/components/board-dock";
import { ChatPage } from "@/components/chat-page";
import { DocsPage } from "@/components/docs";
import { HistoryPage } from "@/components/history-page";
import { SelectionBar } from "@/components/selection-bar";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { StatsPage } from "@/components/stats-page";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBoardData } from "@/hooks/use-board-data";
import { useBoardView } from "@/hooks/use-board-view";
import { useDialogs } from "@/hooks/use-dialogs";
import { useJobActions } from "@/hooks/use-job-actions";
import { useJobs } from "@/hooks/use-jobs";
import { useSelection } from "@/hooks/use-selection";
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

	const [section, setSection] = useState<Section>("board");
	// A column the stats page asked for, held until the board has rendered it.
	const [focus, setFocus] = useState<Status | null>(null);
	// The document a card sent the reader to. Held rather than cleared on the way
	// back, so the rail returns to what was open.
	const [doc, setDoc] = useState<string | null>(null);
	const [helping, setHelping] = useState(false);

	/**
	 * The board's own keys are handed over only while the board is up: `r` on the stats
	 * page reloading a board nobody is looking at, or `/` reaching for a filter field that
	 * is not mounted, are both worse than the key doing nothing. See `use-shortcuts`.
	 */
	useShortcuts({
		help: () => setHelping(true),
		board: () => setSection("board"),
		stats: () => setSection("stats"),
		history: () => setSection("history"),
		chat: () => setSection("chat"),
		docs: () => setSection("docs"),
		...(section === "board" && {
			search: () => document.getElementById("board-search")?.focus(),
			add: dialogs.openAdd,
			reload: () => void store.reload(),
			columnsAll: view.showAllColumns,
			columnsReset: view.resetColumns,
		}),
	});

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

	/** The posting text a card kept, opened in the reader. */
	const openDoc = (path: string) => {
		setDoc(path);
		setSection("docs");
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

	return (
		<TooltipProvider>
			<div className="flex h-screen flex-col">
				<AppRail
					section={section}
					onSection={setSection}
					onHelp={() => setHelping(true)}
				/>

				{store.error && (
					<div className="text-destructive m-4 ml-rail rounded-key bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))] px-3 py-2.5 text-body shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--destructive)_35%,transparent)]">
						<span className="label mr-2 text-legend">Read failed</span>
						{store.error}
					</div>
				)}

				{section === "chat" ? (
					<ChatPage />
				) : section === "docs" ? (
					<DocsPage path={doc} />
				) : section === "stats" ? (
					<StatsPage
						jobs={store.jobs}
						dupes={data.dupes}
						onOpen={openColumn}
						onOutcome={actions.toggleOutcome}
						onStatus={actions.changeStatus}
					/>
				) : section === "history" ? (
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
							onReadPosting={openDoc}
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

				<Toaster position="bottom-right" />
			</div>
		</TooltipProvider>
	);
}
