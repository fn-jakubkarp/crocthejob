import { Check, CopyMinus, ExternalLink } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	COLUMN_LABEL,
	columnOf,
	electDupCanonical,
	type Job,
	type JobChanges,
	readableSalary,
	shortDate,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Company+title matches nobody has judged, from `suggestDupGroups`. */
	groups: Job[][];
	/** One all-or-nothing write for every decision made here. */
	onConfirm: (edits: ({ key: string } & JobChanges)[]) => void;
};

/** Per group: which entry to keep, and which members are the same posting. */
type Decision = {
	canonical: string;
	/** Keys pulled out of the group as separate postings. */
	separate: Set<string>;
	/** Whole group ruled distinct roles that only share a title. */
	distinct: boolean;
};

/** The members of each group, in order - what the answers below are indexed against. */
const digestOf = (groups: Job[][]) =>
	groups.map((group) => group.map((job) => job.key).join("|")).join("~");

/**
 * Confirmation step for the weaker duplicate signal. Same company+title is usually a
 * cross-portal repost, but it also catches separate postings (one role, two cities),
 * so nothing is hidden until the user says so.
 *
 * Negative answers are written too: a group ruled distinct gets `duplicate_of: null`
 * on each member, which stops it being suggested again.
 */
export function DuplicateReview({
	open,
	onOpenChange,
	groups,
	onConfirm,
}: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{groups.length} possible duplicate{groups.length === 1 ? "" : "s"}
					</DialogTitle>
					<DialogDescription>
						These share a company and a title but sit under different URLs,
						which is usually one posting listed on two portals - and sometimes
						two real postings in two cities. Answer each group; the answer is
						written to jobs.json either way, so nothing is asked twice.
					</DialogDescription>
				</DialogHeader>

				{/*
				 * Mounted only while open, so reopening starts from the fresh election
				 * rather than abandoned edits. Keyed by the members as well, since the
				 * answers are held by group index: were the groups themselves to change
				 * underneath, those indices would point at the wrong postings.
				 */}
				<ReviewGroups
					key={digestOf(groups)}
					groups={groups}
					onConfirm={onConfirm}
					onOpenChange={onOpenChange}
				/>
			</DialogContent>
		</Dialog>
	);
}

type GroupsProps = {
	groups: Job[][];
	onConfirm: (edits: ({ key: string } & JobChanges)[]) => void;
	onOpenChange: (open: boolean) => void;
};

/** One row per group, the answers held against it, and the save button. */
function ReviewGroups({ groups, onConfirm, onOpenChange }: GroupsProps) {
	const [decisions, setDecisions] = useState<Record<number, Decision>>(
		() =>
			Object.fromEntries(
				groups.map((group, i) => [
					i,
					{
						canonical: electDupCanonical(group).key,
						separate: new Set<string>(),
						distinct: false,
					},
				]),
			) as Record<number, Decision>,
	);
	const [done, setDone] = useState<Set<number>>(() => new Set());

	// `useCallback` so `edits` can depend on this rather than the value behind it:
	// same recompute, stated where the linter can follow it.
	const decision = useCallback(
		(i: number): Decision =>
			decisions[i] ?? { canonical: "", separate: new Set(), distinct: false },
		[decisions],
	);

	const update = (i: number, next: Partial<Decision>) =>
		setDecisions((prev) => ({ ...prev, [i]: { ...decision(i), ...next } }));

	const mark = (i: number, resolved: boolean) =>
		setDone((prev) => {
			const next = new Set(prev);
			if (resolved) next.add(i);
			else next.delete(i);
			return next;
		});

	/**
	 * Answered groups as per-entry writes. An unanswered group contributes nothing, so
	 * closing early leaves it to be suggested again.
	 */
	const edits = useMemo(() => {
		const out: ({ key: string } & JobChanges)[] = [];
		for (const [i, group] of groups.entries()) {
			if (!done.has(i)) continue;
			const { canonical, separate, distinct } = decision(i);
			for (const job of group) {
				if (distinct || job.key === canonical || separate.has(job.key)) {
					out.push({ key: job.key, duplicate_of: null });
				} else {
					out.push({ key: job.key, duplicate_of: canonical });
				}
			}
		}
		return out;
	}, [groups, done, decision]);

	const hidden = edits.filter((e) => typeof e.duplicate_of === "string").length;

	return (
		<>
			{/* `dvh` as well as a fixed cap: on a short window the list gives up
			    height rather than pushing the footer off screen. */}
			<div className="-mx-1 max-h-[min(26rem,45dvh)] space-y-2.5 overflow-y-auto px-1">
				{groups.map((group, i) => {
					const { canonical, separate, distinct } = decision(i);
					const resolved = done.has(i);
					return (
						<div
							key={group.map((job) => job.key).join("|")}
							className={cn(
								"bg-surface border border-border rounded-well p-2.5 transition-opacity",
								resolved && "opacity-60",
							)}
						>
							<div className="mb-2 flex items-baseline gap-2 px-0.5">
								<p className="min-w-0 flex-1 truncate text-body font-[620] tracking-[-0.014em]">
									{group[0].company || "(no company)"}
									<span className="text-muted-foreground font-normal">
										{" - "}
										{group[0].title?.replace(/\s+/g, " ").trim() ||
											"(untitled)"}
									</span>
								</p>
								{resolved && (
									<span className="text-signal-ink shrink-0 text-meta font-semibold">
										{distinct ? "kept separate" : "linked"}
									</span>
								)}
							</div>

							<div className="space-y-1.5">
								{group.map((job) => {
									const keeper = job.key === canonical && !distinct;
									const pulled = distinct || separate.has(job.key);
									return (
										<div
											key={job.key}
											className={cn(
												"bg-card border border-border flex items-center gap-2 rounded-key px-2.5 py-1.5",
												pulled && !keeper && "opacity-55",
											)}
										>
											{/* Keeper is a radio; the rest follow. Disabled once the
											    group is distinct - then nothing is anybody's copy. */}
											<button
												type="button"
												disabled={distinct}
												onClick={() => update(i, { canonical: job.key })}
												aria-pressed={keeper}
												className={cn(
													"shrink-0 rounded-chip border border-transparent px-1.5 py-px font-data text-data font-semibold tabular-nums transition-[border-color,background-color,color]",
													"focus-visible:outline-signal focus-visible:outline-2 focus-visible:outline-offset-1",
													keeper
														? "border-signal bg-[color-mix(in_oklab,var(--signal)_15%,transparent)] text-signal-ink"
														: "text-muted-foreground hover:text-foreground",
													distinct && "pointer-events-none",
												)}
												aria-label={`Keep #${job.id ?? "?"} as the entry the others are filed under`}
											>
												#{job.id ?? "?"}
											</button>

											<span className="min-w-0 flex-1 truncate text-meta">
												{job.portal?.replace(/-search/g, "") ?? "?"}
												{" · "}
												<span className="text-muted-foreground">
													{COLUMN_LABEL[columnOf(job)]}
												</span>
												{typeof job.rank_score === "number" && (
													<>
														{" · "}
														<span className="text-foreground font-data font-semibold tabular-nums">
															{job.rank_score}
														</span>
													</>
												)}
												{job.salary && (
													<>
														{" · "}
														<span className="font-data">
															{readableSalary(job.salary)}
														</span>
													</>
												)}
												{job.first_seen && (
													<span className="text-muted-foreground">
														{" · "}
														{shortDate(job.first_seen)}
													</span>
												)}
											</span>

											{job.url && (
												<a
													href={job.url}
													target="_blank"
													rel="noreferrer noopener"
													className="text-muted-foreground hover:text-signal-ink relative shrink-0 transition-colors after:absolute after:-inset-2 after:content-['']"
													aria-label={`Open #${job.id ?? "?"} in a new tab`}
												>
													<ExternalLink className="size-3.5" />
												</a>
											)}

											{/* Escape hatch for a group where two of three match. */}
											{!keeper && !distinct && (
												<button
													type="button"
													onClick={() => {
														const next = new Set(separate);
														if (next.has(job.key)) next.delete(job.key);
														else next.add(job.key);
														update(i, { separate: next });
													}}
													className="text-muted-foreground hover:text-foreground relative shrink-0 text-meta font-medium transition-colors after:absolute after:-inset-2 after:content-['']"
												>
													{separate.has(job.key) ? "same" : "separate"}
												</button>
											)}
										</div>
									);
								})}
							</div>

							<div className="mt-2 flex gap-1.5">
								<Button
									variant={resolved && !distinct ? "secondary" : "outline"}
									size="sm"
									className="h-7 flex-1 text-meta"
									onClick={() => {
										update(i, { distinct: false });
										mark(i, true);
									}}
								>
									<Check className="size-3.5" />
									One posting - hide the rest
								</Button>
								<Button
									variant={resolved && distinct ? "secondary" : "outline"}
									size="sm"
									className="h-7 flex-1 text-meta"
									onClick={() => {
										update(i, { distinct: true });
										mark(i, true);
									}}
								>
									<CopyMinus className="size-3.5" />
									Different postings
								</Button>
							</div>
						</div>
					);
				})}
			</div>

			<DialogFooter>
				<span className="text-muted-foreground mr-auto self-center font-data text-data tabular-nums">
					{done.size}/{groups.length} answered
					{hidden > 0 && ` · ${hidden} to hide`}
				</span>
				{/* The backlog case: twenty groups, nearly all the same posting twice.
				    Answers only what is open, never overwrites a decided group. */}
				{done.size < groups.length && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setDone(new Set(groups.map((_, i) => i)))}
					>
						<Check className="size-3.5" />
						Rest are one posting
					</Button>
				)}
				<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
					Cancel
				</Button>
				<Button
					size="sm"
					disabled={edits.length === 0}
					onClick={() => {
						onConfirm(edits);
						onOpenChange(false);
					}}
				>
					Save {done.size} decision{done.size === 1 ? "" : "s"}
				</Button>
			</DialogFooter>
		</>
	);
}
