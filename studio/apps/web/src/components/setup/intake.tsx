import { ArrowRight } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Mark } from "@/components/mark";
import { SetupDocuments } from "@/components/setup/documents";
import { type SectionId, sectionsFor } from "@/components/setup/sections";
import { BoardStep, ImportStep, ModeStep } from "@/components/setup/steps";
import { Button } from "@/components/ui/button";
import type { BoardView } from "@/hooks/use-board-view";
import { useSetup } from "@/hooks/use-setup";
import type { Status } from "@/lib/jobs";
import { cn } from "@/lib/utils";

/**
 * THE INTAKE SHEET — the first run, and every visit to Setup after it.
 *
 * ONE SURFACE, NOT TWO. This was the first run and a settings dialog was the way back
 * in: the same four sections, one at a time, in a box over the board. Two renditions of
 * one thing, and the smaller one was the one you saw every time after the first. Setup
 * is a section of the app now - the rail goes to it like any other - so what you learned
 * to read on the first run is what is there on the tenth.
 *
 * Embedded, it keeps the rail beside it and takes the space that is left; on the first
 * run it takes the whole window, because there is nothing behind it yet to look at.
 *
 * THESIS. Not a wizard. Four dialogs with a Next key make setup a thing to click
 * through; this is one sheet you move down, with a spine that prints each answer
 * back the moment it lands. It refuses the centred stepper the category ships.
 * OWN-WORLD. The board's own: near-black on one hue, three planes, hairlines,
 * Archivo condensed caps from the section heads down to the legends, Geist on every
 * numeral. The accent stays ink and one pixel — here it is the spine's rule.
 * STORY. The reader learns what this board is, answers four things, watches the
 * sheet fill in, and opens a board already shaped the way they said.
 * FIRST VIEWPORT. Spine left with the mark, four numbered sections and their live
 * readouts; the sheet right, product name at display scale over one line of what
 * it is, then section 01 already in view with both mode plates pressable.
 * FORM. Intake sheet, candidate 7 of the ordered structures; seed key 7701e3c5.
 * FINISH: reviewed and scored once, fixed twice. DESIGN.md is not written: this
 * repo has never had one, and a rulebook for the whole app is not this screen's
 * to write.
 *
 * MOTION. One authored moment, in the build's own language: the sheet fills in.
 * Sections deal themselves out on a stagger, the spine's rule is a meter that
 * seats to where you have got to, and every readout re-prints as its answer moves.
 */

type Props = {
	view: BoardView;
	/** Real column populations, so the columns field previews the actual board. */
	counts: Map<Status, number>;
	onImported: () => void;
	/** Left without finishing. The rail carries the way back in. */
	onLater: () => void;
	/** Every section answered. */
	onDone: () => void;
	/** Opened from the rail, with the app around it, rather than as the first run. */
	embedded?: boolean;
};

const THEME_LABEL: Record<string, string> = {
	system: "System",
	light: "Light",
	dark: "Dark",
};

export function SetupIntake({
	view,
	counts,
	onImported,
	onLater,
	onDone,
	embedded = false,
}: Props) {
	const { setup, save } = useSetup();
	const { theme } = useTheme();
	const sections = useMemo(() => sectionsFor(setup.ai), [setup.ai]);

	const scroller = useRef<HTMLDivElement>(null);
	const marks = useRef<(HTMLElement | null)[]>([]);
	const [active, setActive] = useState(0);
	const [imported, setImported] = useState<string | null>(null);
	const [written, setWritten] = useState(0);

	// How far down the sheet the reader has got, which is what the spine's rule
	// meters. Measured off the rects rather than offsetTop: the sections sit inside
	// a centred column, and offsetParent is not the scroller.
	useEffect(() => {
		const root = scroller.current;
		if (!root) return;
		let queued = false;
		const measure = () => {
			queued = false;
			const line = root.getBoundingClientRect().top + root.clientHeight * 0.3;
			let next = 0;
			marks.current.forEach((el, i) => {
				if (el && el.getBoundingClientRect().top <= line) next = i;
			});
			// The floor of the sheet is the last section, whatever the line says. A
			// short final section plus the footer cannot lift its own head over the
			// mark, so without this the spine sticks one row short at the bottom and
			// the meter never fills.
			const atEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
			setActive(
				atEnd ? sections.length - 1 : Math.min(next, sections.length - 1),
			);
		};
		const onScroll = () => {
			if (queued) return;
			queued = true;
			requestAnimationFrame(measure);
		};
		root.addEventListener("scroll", onScroll, { passive: true });
		measure();
		return () => root.removeEventListener("scroll", onScroll);
	}, [sections.length]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onLater();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onLater]);

	const goTo = (i: number) => {
		marks.current[i]?.scrollIntoView({
			behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
				? "auto"
				: "smooth",
			block: "start",
		});
	};

	const finish = () => {
		save({ done: true, step: 0 });
		onDone();
		toast.success("Setup saved", {
			description: "Reopen it any time from the bottom of the rail.",
		});
	};

	// What the spine prints back. Every one of them is the live value, not a tick:
	// a row that only says "done" is a row you have to open again to read.
	const readouts: Record<SectionId, string> = {
		mode: setup.ai ? "With Claude Code" : "Offline, no AI",
		board: [
			THEME_LABEL[theme ?? "system"] ?? "System",
			`${view.visible.length} columns`,
			...(setup.ai && view.fit !== "all" ? [`${view.fit} fit`] : []),
		].join(" · "),
		import: imported ?? "Nothing imported",
		docs: `${written} of 3 written`,
	};

	const fill = (active + 1) / sections.length;

	return (
		<main
			className={cn(
				"flex flex-col overflow-hidden lg:flex-row",
				// The app rail is fixed, so an embedded page pays for it as a left inset
				// and takes whatever height the shell has left. On the first run there is
				// no rail and no shell, and the sheet is the window.
				embedded ? "min-h-0 flex-1 pl-rail" : "h-screen",
			)}
		>
			{/* THE SPINE. Fixed beside the sheet, never scrolling with it: it is the
			    one thing that has to stay legible while the reader is four screens
			    down and wondering what they already answered. */}
			<nav
				aria-label="Setup sections"
				className="bg-surface flex shrink-0 flex-col gap-3 border-b border-border p-3 duration-300 ease-out animate-in fade-in-0 slide-in-from-left-3 motion-reduce:animate-none lg:w-60 lg:border-r lg:border-b-0 lg:gap-5 lg:p-4"
			>
				<div className="flex items-center gap-2">
					{/* The mark only where nothing else is carrying it. Embedded, the app
					    rail is flush against this spine and already has it, and two marks
					    forty pixels apart is the app introducing itself twice. What the
					    spine says here instead is which section you are in. */}
					{embedded ? (
						<span className="label text-foreground text-meta">Setup</span>
					) : (
						<>
							<Mark className="text-foreground size-6" />
							<span className="label text-foreground text-meta">
								Croc the Job
							</span>
						</>
					)}
					{/* The way out, in the one place it is on screen at every width, and
					    ranked as a control rather than a word left beside the mark. Escape
					    does the same. */}
					<span className="ml-auto flex items-center gap-2.5 border-l border-border pl-2.5">
						{/* "Later" only means anything on a run nobody has finished. Opened
						    from the rail it is simply the way back. */}
						<Button variant="outline" size="xs" onClick={onLater}>
							{embedded ? "Board" : "Later"}
						</Button>
					</span>
				</div>

				<div className="relative min-w-0 pl-3">
					{/* The rule, and the accent seated in it. One pixel wide, which is
					    what the accent is worth anywhere in this build. */}
					<span
						aria-hidden
						className="bg-border absolute inset-y-0 left-0 hidden w-px lg:block"
					/>
					<span
						aria-hidden
						style={{ transform: `scaleY(${fill})` }}
						className="bg-signal absolute inset-y-0 left-0 hidden w-px origin-top transition-transform duration-[620ms] ease-out motion-reduce:transition-none lg:block"
					/>

					<ol className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
						{sections.map((section, i) => (
							<li key={section.id} className="min-w-0 shrink-0 lg:shrink">
								<button
									type="button"
									aria-current={i === active ? "step" : undefined}
									onClick={() => goTo(i)}
									className={cn(
										"w-full rounded-key px-2 py-1.5 text-left transition-colors duration-150 ease-out outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal",
										i === active ? "bg-card" : "hover:bg-card-hover",
									)}
								>
									<span className="flex items-baseline gap-1.5">
										<span className="text-muted-foreground font-data text-legend tabular-nums">
											{String(i + 1).padStart(2, "0")}
										</span>
										<span
											className={cn(
												"label text-meta",
												i === active
													? "text-foreground"
													: "text-muted-foreground",
											)}
										>
											{section.label}
										</span>
									</span>
									{/* Keyed on the value, so a changed answer prints rather than
									    swapping silently: it lands at full ink and settles. */}
									{/* At every width: the answer printing back is the sheet's
									    one authored moment, and a phone that only shows four
									    labels is the stepper again. */}
									<span
										key={readouts[section.id]}
										className="print-in text-muted-foreground mt-0.5 block max-w-[11rem] truncate text-body"
									>
										{readouts[section.id]}
									</span>
								</button>
							</li>
						))}
					</ol>

					{/* The same reading as the rule beside it, for a window too narrow to
					    carry the spine down the side. */}
					<span
						aria-hidden
						style={{ transform: `scaleX(${fill})` }}
						className="bg-signal mt-2 block h-px origin-left transition-transform duration-[620ms] ease-out motion-reduce:transition-none lg:hidden"
					/>
				</div>
			</nav>

			{/* THE SHEET. */}
			<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
				{/* Every section is a ruled row: what it is on the left, the controls on
				    the right. A centred column of prose would leave the window empty on
				    both sides and read as a page; this reads as a sheet. */}
				<div className="mx-auto w-full max-w-[62rem] px-5 py-8 sm:px-9 lg:py-14">
					<header className="duration-500 ease-out animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
						{/* Fluid rather than stepped at a breakpoint: a display size that
						    only exists on a wide window gives the phone a different sheet,
						    and the cap height is what makes this the masthead at any width. */}
						<h1 className="label text-[clamp(2rem,10.5vw,2.75rem)] leading-[0.95]">
							Croc the Job
						</h1>
						<p className="text-ink-2 mt-4 max-w-[52ch] text-title leading-relaxed">
							A board over your own jobs file, and the file stays the one that
							matters. Four answers and it opens.
						</p>
					</header>

					{sections.map((section, i) => {
						// The documents section takes the whole width: its body is an editor
						// rather than a row of controls, and a ruled margin holding one
						// heading against 300px of nothing is a gutter pretending to be one.
						const wide = section.id === "docs";
						return (
							<section
								key={section.id}
								ref={(el) => {
									marks.current[i] = el;
								}}
								aria-labelledby={`intake-${section.id}`}
								// Only the first section deals itself out with the header: the
								// three below it are off screen while that plays, and an
								// identical entrance on every section is an effect rather than
								// a moment. What the rest of the sheet spends motion on is the
								// answer landing in the spine.
								className={cn(
									"mt-8 grid scroll-mt-6 gap-y-4 border-t border-border pt-6",
									!wide && "lg:grid-cols-[17rem_minmax(0,1fr)]",
									i === 0 &&
										"[animation-delay:120ms] duration-500 ease-out animate-in fade-in-0 slide-in-from-bottom-2 [animation-fill-mode:backwards] motion-reduce:animate-none",
								)}
							>
								{/* The heading sits in a ruled margin rather than a gutter, which
							    is how every other track in this build is divided, and reads
							    in the app's sentence-case register: three voices on the
							    sheet, not one condensed cap at four sizes. The right padding
							    is the gutter: without it the head runs into the rule. */}
								<div
									className={cn(
										!wide && "lg:sticky lg:top-6 lg:self-start lg:pr-8",
									)}
								>
									<div className="flex items-baseline gap-2.5">
										<span className="text-muted-foreground font-data text-data tabular-nums">
											{String(i + 1).padStart(2, "0")}
										</span>
										<h2
											id={`intake-${section.id}`}
											className="font-heading text-balance text-readout leading-[1.08] font-medium tracking-[-0.02em]"
										>
											{section.title}
										</h2>
									</div>
									<p className="text-muted-foreground mt-2 text-body leading-[1.5]">
										{section.line}
									</p>
								</div>

								<div
									className={cn(
										"min-w-0",
										!wide && "lg:border-l lg:border-border lg:pl-9",
									)}
								>
									{section.id === "mode" && <ModeStep view={view} />}
									{section.id === "board" && (
										<BoardStep view={view} counts={counts} />
									)}
									{section.id === "import" && (
										<ImportStep onImported={onImported} onNote={setImported} />
									)}
									{section.id === "docs" && (
										<SetupDocuments onWritten={setWritten} />
									)}
								</div>
							</section>
						);
					})}

					{/* One way out, at the bottom of the spine, and one way on, here. The
					    same ghost word in both places was two answers to one question. */}
					<div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
						<p className="text-muted-foreground text-body">
							{embedded
								? "Every answer here can be changed again, any time."
								: "All of it is under Setup once the board is open."}
						</p>
						<Button size="sm" onClick={finish}>
							{embedded ? "Back to the board" : "Open the board"}
							<ArrowRight data-icon="inline-end" />
						</Button>
					</div>
				</div>
			</div>
		</main>
	);
}
