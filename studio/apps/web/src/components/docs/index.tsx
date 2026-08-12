import { formatDistanceToNow } from "date-fns";
import { Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Outline } from "@/components/docs/outline";
import { Button } from "@/components/ui/button";
import { useOutline } from "@/hooks/use-outline";
import { DOC_COMPONENTS } from "@/lib/markdown";
import { cn } from "@/lib/utils";

type Entry = {
	path: string;
	title?: string;
	size: number;
	mtime: number;
};

/** Folder names as a person says them, not as the file system spells them. */
const NAMES: Record<string, string> = {
	documents: "Documents",
	cv: "CV",
	linkedin: "LinkedIn",
	postings: "Postings",
	references: "References",
	"job-application-assistant": "Application assistant",
};

const label = (dir: string) => {
	const last = dir.split("/").pop() ?? dir;
	return (
		NAMES[last] ??
		last.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase())
	);
};

const filename = (file: string) => file.slice(file.lastIndexOf("/") + 1);

/**
 * The documents, read in the app.
 *
 * THESIS. The CVs, postings and profile notes are the output of everything else in
 * this repo, and until now they were only readable in an editor. This is the reading
 * room for them: one index, one page, one outline. It writes nothing - Claude writes
 * these files from the chat page, and a reader that could also edit would put the
 * repo's real source of truth behind a textarea.
 *
 * WORLD. The board's, one plane further down. There a recessed well holds raised
 * cards; here a recessed index holds the file you are on, raised, in the same tile
 * plane as the sheet it opened - the selected row reads as the near edge of the page
 * beside it. The outline gets no plate at all, because three boxes in a row would
 * make the reading column the filling in a sandwich.
 *
 * READING. The page is set for prose and nothing else: Source Serif at 16px on a
 * 68-character measure, sitting on the lightest surface in the system. The app's own
 * Archivo stays on the headings and the chrome, so a document is visibly the app's
 * document without being set in a UI face. Section breaks are grooves, not rules, for
 * the same reason the stats page mills its readings in.
 */
export function DocsPage({ path }: { path?: string | null }) {
	const [files, setFiles] = useState<Entry[]>([]);
	// A card can open the reader on one document. It is the initial selection rather
	// than a controlled value: once here, the index is what chooses.
	const [current, setCurrent] = useState<string | null>(path ?? null);
	const [text, setText] = useState("");
	const [state, setState] = useState<"loading" | "ready" | "error">("loading");
	const [error, setError] = useState<string | null>(null);
	const scroller = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let live = true;
		fetch("/api/files")
			.then((res) => res.json())
			.then((body: { files?: Entry[]; error?: string }) => {
				if (!live) return;
				if (body.error) {
					setError(body.error);
					setState("error");
					return;
				}
				const found = body.files ?? [];
				setFiles(found);
				setCurrent((prev) => prev ?? found[0]?.path ?? null);
				if (found.length === 0) setState("ready");
			})
			.catch((err: unknown) => {
				if (!live) return;
				setError(String(err));
				setState("error");
			});
		return () => {
			live = false;
		};
	}, []);

	useEffect(() => {
		if (!current) return;
		let live = true;
		setState("loading");
		fetch(`/api/files?path=${encodeURIComponent(current)}`)
			.then((res) => res.json())
			.then((body: { text?: string; error?: string }) => {
				if (!live) return;
				if (body.error) {
					setError(body.error);
					setState("error");
					return;
				}
				setText(body.text ?? "");
				setError(null);
				setState("ready");
				// A new document opens at its own top, not at the last one's scroll.
				scroller.current?.scrollTo({ top: 0 });
			})
			.catch((err: unknown) => {
				if (!live) return;
				setError(String(err));
				setState("error");
			});
		return () => {
			live = false;
		};
	}, [current]);

	// The API returns the roots in order, so a Map keeps the folders in that order
	// too: the documents first, the assistant's own notes under them. Files sort
	// inside their folder, which is also what puts 01 through 07 in sequence.
	const groups = useMemo(() => {
		const byDir = new Map<string, Entry[]>();
		for (const file of files) {
			const dir = file.path.slice(0, file.path.lastIndexOf("/"));
			const bucket = byDir.get(dir);
			if (bucket) bucket.push(file);
			else byDir.set(dir, [file]);
		}
		return [...byDir].map(([dir, entries]) => {
			const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
			return {
				dir,
				// A title is the better name for a row until it stops telling two rows
				// apart: four tailored CVs all open with the same name heading, and four identical
				// rows are not an index. Those fall back to the filename, which is what
				// actually distinguishes them.
				rows: sorted.map((file) => {
					const shared =
						file.title &&
						sorted.some(
							(other) => other !== file && other.title === file.title,
						);
					return {
						file,
						name:
							file.title && !shared
								? file.title
								: filename(file.path).replace(/\.md$/, ""),
					};
				}),
			};
		});
	}, [files]);

	const entry = files.find((file) => file.path === current);

	// The opening heading is the document's name, and the header above already says it.
	const body = useMemo(() => text.replace(/^\s*#\s+.+\n+/, ""), [text]);
	const words = useMemo(
		() => (body.trim() ? body.trim().split(/\s+/).length : 0),
		[body],
	);

	const { sections, active, docRef } = useOutline(scroller);

	const title = entry?.title ?? (current ? filename(current) : "Documents");

	return (
		<main className="flex min-h-0 flex-1 gap-3 p-3 pl-[4.5rem]">
			<h1 className="sr-only">Documents</h1>

			{/* The index. A well, like a board column, and the row you are reading is
			    raised out of it in the same material as the sheet. */}
			<nav
				aria-label="Documents"
				className="bg-surface border border-border w-60 shrink-0 overflow-y-auto rounded-well p-2"
			>
				{groups.map(({ dir, rows }) => (
					<section key={dir} className="mb-4 last:mb-1">
						<h2 className="label text-muted-foreground px-2 py-1.5 text-legend">
							{label(dir)}
						</h2>
						{rows.map(({ file, name }) => {
							const selected = file.path === current;
							return (
								<button
									key={file.path}
									type="button"
									onClick={() => setCurrent(file.path)}
									aria-current={selected ? "page" : undefined}
									className={cn(
										"block w-full rounded-key border border-transparent px-2 py-1.5 text-left text-body transition-[background-color,border-color,color] duration-150 ease-out outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal",
										selected
											? "bg-card border-border text-foreground"
											: "text-muted-foreground hover:bg-background hover:text-foreground",
									)}
								>
									<span className="line-clamp-2 leading-snug">{name}</span>
								</button>
							);
						})}
					</section>
				))}
			</nav>

			<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto grid max-w-[68rem] gap-x-8 xl:grid-cols-[minmax(0,1fr)_13rem]">
					{/* The sheet. Raised, lightest plane, page margins rather than card
					    padding, and a measure that stops well short of its own width. */}
					<article
						// Keyed by path, so switching documents replays the one entrance.
						key={current ?? "none"}
						data-doc-sheet
						// 38.5rem less its own margins is 68 characters of Source Serif at
						// 16px: the sheet is sized to the measure rather than the measure
						// fitted into a sheet.
						className="bg-card border border-border mx-auto my-3 w-full max-w-[38.5rem] rounded-well px-6 py-10 duration-200 ease-out animate-in fade-in-0 slide-in-from-bottom-1 sm:px-12"
					>
						{state === "error" && (
							<p className="text-destructive rounded-key bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))] px-3 py-2.5 text-body">
								<span className="label mr-2 text-legend">Read failed</span>
								{error}
							</p>
						)}

						{state === "loading" && (
							<div aria-hidden className="animate-pulse space-y-4">
								<div className="h-7 w-1/2 rounded-key bg-surface" />
								<div className="h-3 w-1/3 rounded-key bg-surface" />
								<div className="mt-10 h-3 w-full rounded-key bg-surface" />
								<div className="h-3 w-11/12 rounded-key bg-surface" />
								<div className="h-3 w-10/12 rounded-key bg-surface" />
							</div>
						)}

						{state === "ready" && files.length === 0 && (
							<div className="py-16 text-center">
								<h2 className="font-heading text-module font-semibold">
									Nothing written yet
								</h2>
								<p className="text-muted-foreground mx-auto mt-2 max-w-sm text-body leading-relaxed">
									This reads the markdown under{" "}
									<span className="font-data">documents/</span> and the
									application assistant's notes. Ask Claude on the Chat page for
									a tailored CV and it lands here.
								</p>
							</div>
						)}

						{state === "ready" && current && (
							<>
								<header className="mb-8">
									<div className="flex items-start justify-between gap-4">
										<h2 className="font-heading text-readout leading-tight font-semibold tracking-[-0.02em] text-balance">
											{title}
										</h2>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label="Copy markdown"
											onClick={() => {
												void navigator.clipboard
													.writeText(text)
													.then(() => toast.success("Markdown copied"))
													.catch(() => toast.error("Clipboard refused"));
											}}
										>
											<Copy />
										</Button>
									</div>
									<p className="text-muted-foreground mt-2 font-data text-meta">
										{current} &middot; {words.toLocaleString()} words
										{entry &&
											` · edited ${formatDistanceToNow(entry.mtime, { addSuffix: true })}`}
									</p>
									<div className="rule mt-5" />
								</header>

								<div ref={docRef} className="doc">
									<ReactMarkdown
										remarkPlugins={[remarkGfm]}
										components={DOC_COMPONENTS}
									>
										{body}
									</ReactMarkdown>
								</div>
							</>
						)}
					</article>

					<Outline sections={sections} active={active} />
				</div>
			</div>
		</main>
	);
}
