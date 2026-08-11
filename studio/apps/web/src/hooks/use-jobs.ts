import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { oneLine } from "@/lib/board";
import {
	createJob,
	deleteJob,
	fetchJobs,
	type Job,
	type JobChanges,
	merged,
	type NewJob,
	patchEdits,
	patchJob,
	patchJobs,
	saveJobPosting,
} from "@/lib/jobs";

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type JobsStore = {
	jobs: Job[];
	loading: boolean;
	/** The read that failed, if the last one did. */
	error: string | null;
	/** How many writes are in flight. */
	saving: number;
	reload: () => Promise<void>;
	/** The current entry, not a copy taken when a handler was made. */
	find: (key: string) => Job | undefined;
	/** Optimistic. Rethrows, so a caller can keep its dialog open. */
	mutate: (key: string, changes: JobChanges, describe: string) => Promise<void>;
	/**
	 * Optimistic. Resolves to whether it landed; never throws. Silent on success - the
	 * caller says what a batch did, and in what colour.
	 */
	batch: (
		keys: string[],
		changes: JobChanges,
		describe: string,
	) => Promise<boolean>;
	/** Per-entry changes in one all-or-nothing write. Never throws. */
	edits: (
		list: ({ key: string } & JobChanges)[],
		said: string,
		failed: string,
	) => Promise<void>;
	saveReview: (edits: ({ key: string } & JobChanges)[]) => Promise<void>;
	addJob: (draft: NewJob) => Promise<void>;
	/** Hand-added entries only; the server refuses the rest. Never throws. */
	removeJob: (key: string) => Promise<void>;
	/** A JD typed in by hand, for an entry /scrape never kept one for. Rethrows. */
	savePosting: (key: string, text: string) => Promise<void>;
};

/**
 * The board's copy of data/jobs.json and every write against it. Each write applies
 * locally first and rolls the list back on failure - that is what makes a drag feel
 * instant on a 400-entry file.
 */
export function useJobs(): JobsStore {
	const [jobs, setJobs] = useState<Job[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(0);

	// Handlers need the current list for rollback; a ref keeps them stable, which is
	// what lets JobCard's `memo` hold. Written on commit, not in render: React can
	// discard a render, and a rollback must never restore a list nobody ever saw.
	// Only handlers read it, so a value settled before paint is soon enough.
	const jobsRef = useRef(jobs);
	useLayoutEffect(() => {
		jobsRef.current = jobs;
	}, [jobs]);

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			setJobs(await fetchJobs());
			setError(null);
		} catch (e) {
			setError(reason(e));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	const find = useCallback(
		(key: string) => jobsRef.current.find((j) => j.key === key),
		[],
	);

	const mutate = useCallback(
		async (key: string, changes: JobChanges, describe: string) => {
			const rollback = jobsRef.current;
			setJobs((prev) =>
				prev.map((j) => (j.key === key ? merged(j, changes) : j)),
			);
			setSaving((n) => n + 1);
			try {
				const now = await patchJob(key, changes);
				// A corrected URL re-keys the entry server-side. Followed, not refetched,
				// so the card does not remount mid-edit.
				if (now !== key) {
					setJobs((prev) =>
						prev.map((j) =>
							j.key === key
								? { ...j, key: now }
								: j.duplicate_of === key
									? { ...j, duplicate_of: now }
									: j,
						),
					);
				}
			} catch (e) {
				setJobs(rollback);
				toast.error(`${describe} failed`, { description: reason(e) });
				throw e;
			} finally {
				setSaving((n) => n - 1);
			}
		},
		[],
	);

	/**
	 * A different write per entry in one all-or-nothing request. The duplicate review
	 * needs it - a group writes a canonical key to the copies and null to the separates -
	 * and so does undoing a batch, where every entry goes back to a different status.
	 */
	const edits = useCallback(
		async (
			list: ({ key: string } & JobChanges)[],
			said: string,
			failed: string,
		) => {
			if (list.length === 0) return;
			const rollback = jobsRef.current;
			const byKey = new Map(list.map((e) => [e.key, e]));
			setJobs((prev) =>
				prev.map((job) => {
					const edit = byKey.get(job.key);
					if (!edit) return job;
					const { key: _key, ...changes } = edit;
					return merged(job, changes);
				}),
			);
			setSaving((n) => n + 1);
			try {
				await patchEdits(list);
				toast.success(said);
			} catch (e) {
				setJobs(rollback);
				toast.error(`${failed} failed`, { description: reason(e) });
			} finally {
				setSaving((n) => n - 1);
			}
		},
		[],
	);

	/** One request and one file write for the whole selection, not one per card. */
	const batch = useCallback(
		async (keys: string[], changes: JobChanges, describe: string) => {
			if (keys.length === 0) return false;
			const rollback = jobsRef.current;
			const held = new Set(keys);
			setJobs((prev) =>
				prev.map((j) => (held.has(j.key) ? merged(j, changes) : j)),
			);
			setSaving((n) => n + 1);
			try {
				await patchJobs(keys, changes);
				return true;
			} catch (e) {
				setJobs(rollback);
				toast.error(`Batch ${describe} failed`, { description: reason(e) });
				return false;
			} finally {
				setSaving((n) => n - 1);
			}
		},
		[],
	);

	/** Every answer from the review dialog in one all-or-nothing write. */
	const saveReview = useCallback(
		async (list: ({ key: string } & JobChanges)[]) => {
			const hidden = list.filter(
				(e) => typeof e.duplicate_of === "string",
			).length;
			await edits(
				list,
				hidden > 0
					? `${hidden} duplicate${hidden === 1 ? "" : "s"} hidden`
					: "Kept separate",
				"Saving the duplicate review",
			);
		},
		[edits],
	);

	/**
	 * Optimistic like the rest, and the copies it was holding come back standalone -
	 * the same thing the server does to them, so the board does not have to reload to
	 * agree with the file.
	 */
	const removeJob = useCallback(async (key: string) => {
		const rollback = jobsRef.current;
		const gone = rollback.find((j) => j.key === key);
		setJobs((prev) =>
			prev
				.filter((j) => j.key !== key)
				.map((j) =>
					j.duplicate_of === key ? { ...j, duplicate_of: null } : j,
				),
		);
		setSaving((n) => n + 1);
		try {
			await deleteJob(key);
			toast.success(`${gone?.company ?? "Posting"} deleted`, {
				description: oneLine(gone?.title),
			});
		} catch (e) {
			setJobs(rollback);
			toast.error("Delete failed", { description: reason(e) });
		} finally {
			setSaving((n) => n - 1);
		}
	}, []);

	const savePosting = useCallback(async (key: string, text: string) => {
		setSaving((n) => n + 1);
		try {
			const path = await saveJobPosting(key, text);
			setJobs((prev) =>
				prev.map((j) => (j.key === key ? { ...j, posting_file: path } : j)),
			);
		} catch (e) {
			toast.error("Saving the posting failed", { description: reason(e) });
			throw e;
		} finally {
			setSaving((n) => n - 1);
		}
	}, []);

	const addJob = useCallback(async (draft: NewJob) => {
		const created = await createJob(draft);
		// Inserted, not refetched, which would remount every card.
		setJobs((prev) => [...prev, created]);
		toast.success(`${created.company ?? "Posting"} added`, {
			description: oneLine(created.title),
		});
	}, []);

	return {
		jobs,
		loading,
		error,
		saving,
		reload,
		find,
		mutate,
		batch,
		edits,
		saveReview,
		addJob,
		removeJob,
		savePosting,
	};
}
