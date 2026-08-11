import { Check, LoaderCircle } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { Job } from "@/lib/jobs";
import { cn } from "@/lib/utils";

const SAVE_DEBOUNCE = 700;

export /**
 * The one editable field on the panel, and the only state it holds. Debounced
 * autosave, flushed on unmount so closing never loses keystrokes.
 */
function Notes({
	job,
	onNotes,
}: {
	job: Job;
	onNotes: (notes: string) => Promise<void>;
}) {
	const [notes, setNotes] = useState(job.notes ?? "");
	/**
	 * `label` outlives `shown` on purpose: the pill fades out rather than unmounting,
	 * so it must keep its last word rather than swap mid-fade.
	 */
	const [save, setSave] = useState<{
		shown: boolean;
		label: "saving" | "saved";
	}>({ shown: false, label: "saving" });
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	// The pill's own timer, separate from the save debounce: closing the popover
	// mid-save otherwise leaves it to fire into an unmounted tree.
	const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Written on commit, not in render: React can discard a render, and only the
	// unmount flush reads this, so a value settled before paint is soon enough.
	const latest = useRef(notes);
	useLayoutEffect(() => {
		latest.current = notes;
	}, [notes]);

	// In a ref, not a dep: as a dep the effect re-arms per keystroke and cleanup fires
	// mid-typing. Reassigned on every commit, so the closure it holds is never stale.
	const flush = useRef<() => void>(() => {});
	useLayoutEffect(() => {
		flush.current = () => {
			if (timer.current) clearTimeout(timer.current);
			if (latest.current !== (job.notes ?? "")) void onNotes(latest.current);
		};
	});
	useEffect(
		() => () => {
			if (hide.current) clearTimeout(hide.current);
			flush.current();
		},
		[],
	);

	function edit(value: string) {
		setNotes(value);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(async () => {
			setSave({ shown: true, label: "saving" });
			try {
				await onNotes(value);
				setSave({ shown: true, label: "saved" });
				hide.current = setTimeout(
					() => setSave((prev) => ({ ...prev, shown: false })),
					1600,
				);
			} catch {
				setSave((prev) => ({ ...prev, shown: false }));
			}
		}, SAVE_DEBOUNCE);
	}

	return (
		<div>
			<div className="mb-2 flex items-center justify-between">
				<p className="label text-muted-foreground text-data">Notes</p>
				{/* Always mounted and faded, not conditionally rendered. */}
				<span
					className={cn(
						"text-muted-foreground flex h-4 items-center gap-1 text-data transition-opacity duration-200 ease-out",
						!save.shown && "opacity-0",
					)}
				>
					{/* The spin stops on "saved", or the tick lands mid-rotation. */}
					<MorphIcon
						icon={save.label === "saved" ? Check : LoaderCircle}
						spring="snappy"
						strokeWidth={2}
						className={cn(
							"size-3",
							save.label === "saving" &&
								"animate-spin [animation-duration:0.7s]",
						)}
					/>
					{save.label === "saved" ? "saved" : "saving"}
				</span>
			</div>
			{/* `resize-none`: `field-sizing-content` already grows it as you type. */}
			<Textarea
				value={notes}
				onChange={(e) => edit(e.target.value)}
				rows={5}
				placeholder="Recruiter name, rate discussed, what to ask, why you passed…"
				className="resize-none text-body leading-[1.5]"
			/>
			<p className="text-muted-foreground mt-1.5 text-meta">
				Autosaves to jobs.json a moment after you stop typing.
			</p>
		</div>
	);
}
