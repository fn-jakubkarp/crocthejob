import { useCallback, useState } from "react";
import type { Job } from "@/lib/jobs";

/** Which of the board's dialogs is open, and on what. */
export type Dialogs = {
	adding: boolean;
	/** The entry the form dialog is on, or null when adding or closed. */
	editing: Job | null;
	/** Which field `openEdit` asked to land the cursor on, if any. */
	editFocus: "url" | null;
	reviewing: boolean;
	/** The entry being filed under another, or null when closed. */
	linking: Job | null;
	/** The reason prompt for skipping the whole selection. */
	dismissing: boolean;
	openAdd: () => void;
	openEdit: (job: Job, focus?: "url") => void;
	/** Both halves of the form dialog close together — one dialog, two modes. */
	closeForm: () => void;
	setReviewing: (open: boolean) => void;
	setLinking: (job: Job | null) => void;
	setDismissing: (open: boolean) => void;
};

export function useDialogs(): Dialogs {
	const [adding, setAdding] = useState(false);
	const [editing, setEditing] = useState<Job | null>(null);
	const [editFocus, setEditFocus] = useState<"url" | null>(null);
	const [reviewing, setReviewing] = useState(false);
	const [linking, setLinking] = useState<Job | null>(null);
	const [dismissing, setDismissing] = useState(false);

	const openAdd = useCallback(() => setAdding(true), []);
	const openEdit = useCallback((job: Job, focus?: "url") => {
		setEditing(job);
		setEditFocus(focus ?? null);
	}, []);
	const closeForm = useCallback(() => {
		setAdding(false);
		setEditing(null);
		setEditFocus(null);
	}, []);

	return {
		adding,
		editing,
		editFocus,
		reviewing,
		linking,
		dismissing,
		openAdd,
		openEdit,
		closeForm,
		setReviewing,
		setLinking,
		setDismissing,
	};
}
