import { useMemo } from "react";
import type { BoardView } from "@/hooks/use-board-view";
import { type ByColumn, filterJobs, groupByColumn } from "@/lib/board";
import {
	buildDupIndex,
	type DupIndex,
	type Job,
	suggestDupGroups,
} from "@/lib/jobs";

export type BoardData = {
	/** See `buildDupIndex`. */
	dupes: DupIndex;
	/** Company+title matches nobody has ruled on yet. */
	suggestions: Job[][];
	/** Population before any filter. */
	onBoard: Job[];
	filtered: Job[];
	byColumn: ByColumn;
	narrowing: boolean;
	/** Copies kept off screen. */
	hidden: number;
};

/**
 * Everything the columns render. Each step is memoised separately, so typing in the
 * filter does not rebuild the duplicate index.
 */
export function useBoardData(jobs: Job[], view: BoardView): BoardData {
	const { query, fit, showDupes, sortFor } = view;

	const dupes = useMemo(() => buildDupIndex(jobs), [jobs]);
	const suggestions = useMemo(() => suggestDupGroups(jobs), [jobs]);

	// Copies drop out before any filter, so counts and "of N shown" are about postings
	// rather than entries.
	const onBoard = useMemo(
		() => (showDupes ? jobs : jobs.filter((job) => !dupes.of.has(job.key))),
		[jobs, dupes, showDupes],
	);

	const filtered = useMemo(
		() => filterJobs(onBoard, query, fit),
		[onBoard, query, fit],
	);

	const byColumn = useMemo(
		() => groupByColumn(onBoard, filtered, sortFor),
		[onBoard, filtered, sortFor],
	);

	return {
		dupes,
		suggestions,
		onBoard,
		filtered,
		byColumn,
		narrowing: filtered.length !== onBoard.length,
		hidden: dupes.of.size,
	};
}
