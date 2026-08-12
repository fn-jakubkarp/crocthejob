import { useCallback, useMemo, useState } from "react";
import { LS, usePersisted } from "@/hooks/use-persisted";
import {
	COLUMNS,
	type ColumnDef,
	DEFAULT_VISIBLE,
	effectiveSort,
	isSortId,
	isStatus,
	laneOf,
	type SortId,
	type Status,
} from "@/lib/jobs";

/** A held set with one column brought up, in pipeline order rather than click order. */
function withColumn(held: Status[], status: Status): Status[] {
	const up = new Set(held);
	const next: Status[] = [];
	for (const c of COLUMNS)
		if (c.status === status || up.has(c.status)) next.push(c.status);
	return next;
}

export type BoardView = {
	query: string;
	setQuery: (value: string) => void;
	/** A `fit` value, or "all". Survives a reload: the wizard sets it as a default. */
	fit: string;
	setFit: (value: string) => void;
	/** Whether the copies the board normally hides are on screen. */
	showDupes: boolean;
	toggleDupes: () => void;
	visible: Status[];
	/** The visible column definitions, in pipeline order. */
	shown: ColumnDef[];
	sortFor: (status: Status) => SortId;
	setColumnSort: (status: Status, sort: SortId) => void;
	toggleColumn: (status: Status) => void;
	/** Brings a column up if it is hidden, and leaves the rest alone. */
	showColumn: (status: Status) => void;
	showAllColumns: () => void;
	resetColumns: () => void;
};

/**
 * What the user did to the view, not the data: the filter, which columns are up, how
 * each is sorted. Everything but the search box survives a reload.
 */
export function useBoardView(): BoardView {
	const [query, setQuery] = useState("");

	const [fit, setFit] = usePersisted<string>(LS.fit, "all");
	const [showDupes, setShowDupes] = usePersisted<boolean>(LS.dupes, false);
	const [visible, setVisible] = usePersisted<Status[]>(
		LS.visible,
		DEFAULT_VISIBLE,
		// A column this build no longer knows about is dropped, not rendered.
		(stored) => stored.filter(isStatus),
	);
	const [sorts, setSorts] = usePersisted<Partial<Record<Status, SortId>>>(
		LS.sorts,
		{},
		// Same rule as the visible columns: a sort this build dropped or renamed falls
		// back to the lane's default rather than reaching `sorter` and matching nothing.
		(stored) =>
			Object.fromEntries(
				Object.entries(stored).filter(
					([status, sort]) => isStatus(status) && isSortId(sort),
				),
			),
	);

	const toggleDupes = useCallback(
		() => setShowDupes((v) => !v),
		[setShowDupes],
	);

	const sortFor = useCallback(
		(status: Status) => effectiveSort(laneOf(status), sorts[status]),
		[sorts],
	);

	const setColumnSort = useCallback(
		(status: Status, sort: SortId) => {
			setSorts((prev) => ({ ...prev, [status]: sort }));
		},
		[setSorts],
	);

	const toggleColumn = useCallback(
		(status: Status) => {
			setVisible((prev) =>
				prev.includes(status)
					? prev.filter((s) => s !== status)
					: withColumn(prev, status),
			);
		},
		[setVisible],
	);

	const showColumn = useCallback(
		(status: Status) => {
			setVisible((prev) =>
				prev.includes(status) ? prev : withColumn(prev, status),
			);
		},
		[setVisible],
	);

	const showAllColumns = useCallback(
		() => setVisible(COLUMNS.map((c) => c.status)),
		[setVisible],
	);

	const resetColumns = useCallback(
		() => setVisible(DEFAULT_VISIBLE),
		[setVisible],
	);

	const shown = useMemo(
		() => COLUMNS.filter((c) => visible.includes(c.status)),
		[visible],
	);

	return {
		query,
		setQuery,
		fit,
		setFit,
		showDupes,
		toggleDupes,
		visible,
		shown,
		sortFor,
		setColumnSort,
		toggleColumn,
		showColumn,
		showAllColumns,
		resetColumns,
	};
}
