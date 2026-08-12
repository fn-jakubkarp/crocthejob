import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { Chip, StripHead } from "@/components/strip";
import { HUE, type Hue } from "@/lib/strip";

type Entry = { path: string; title?: string; size?: number; mtime: number };

/** What each kind is called on its chip, and the order the rows come in. */
const KIND = {
	posting: { label: "JD", hue: "found" },
	cv: { label: "CV", hue: "applied" },
	prep: { label: "prep", hue: "tech" },
	research: { label: "research", hue: "ranked" },
	note: { label: "note", hue: "added" },
} as const satisfies Record<string, { label: string; hue: Hue }>;

type Kind = keyof typeof KIND;

const ORDER: Kind[] = ["posting", "cv", "prep", "research", "note"];

const filename = (file: string) => file.slice(file.lastIndexOf("/") + 1);

/** Words a humanised filename should not lowercase. */
const ACRONYM: Record<string, string> = { cv: "CV", jd: "JD", qa: "QA" };

function readable(path: string): string {
	const words = filename(path)
		.replace(/\.md$/, "")
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((word) => ACRONYM[word.toLowerCase()] ?? word);
	const text = words.join(" ");
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * What a file is, off its name. The skills write these names, so the guess is against a
 * convention rather than against arbitrary input - and a row that guesses wrong still
 * prints its own path, so the mistake is visible rather than silent.
 */
function kindOf(path: string): Kind {
	const name = filename(path).toLowerCase();
	if (/(^|[-_])jd([-_.]|$)|posting|offer|advert/.test(name)) return "posting";
	if (/(^|[-_])cv([-_.]|$)|resume|letter/.test(name)) return "cv";
	if (/prep|interview|question/.test(name)) return "prep";
	if (/research|company|market|salary/.test(name)) return "research";
	return "note";
}

/**
 * What has been written for this application: the job description, the tailored CV, the
 * interview prep packs, the research, the outcome record.
 *
 * Found through `application_dir` on the entry, which `/apply`, `/outcome` and `/research`
 * set when they create the folder, plus `posting_file` wherever /scrape left the
 * description. Not rebuilt out of company and title: a slug guessed here and a slug
 * written there disagree the first time a company name has a dot in it, and then the panel
 * is silently empty on an application that has four documents.
 *
 * A row opens the reading modal rather than leaving for the Docs index. Walking away from
 * this page to read a document written for it, and then walking back, was the thing this
 * page exists to stop.
 */
export function Artifacts({
	dir,
	posting,
	onOpen,
}: {
	dir?: string;
	/** The saved job description, wherever it lives. */
	posting?: string;
	/** Opens that document in the reading modal. */
	onOpen: (path: string, title: string) => void;
}) {
	const [files, setFiles] = useState<Entry[]>([]);
	// Until the listing answers there is nothing to claim: an entry with four documents
	// was painting "nothing written for this one yet" and then replacing it.
	const [asked, setAsked] = useState(false);

	useEffect(() => {
		if (!dir && !posting) {
			setAsked(true);
			return;
		}
		setAsked(false);
		let live = true;
		const prefix = dir ? `${dir.replace(/\/+$/, "")}/` : null;
		fetch("/api/files")
			.then((res) => res.json())
			.then((body: { files?: Entry[] }) => {
				if (!live) return;
				setFiles(
					(body.files ?? []).filter(
						(file) =>
							file.path === posting ||
							(prefix !== null && file.path.startsWith(prefix)),
					),
				);
				setAsked(true);
			})
			.catch(() => {
				if (!live) return;
				setFiles([]);
				setAsked(true);
			});
		return () => {
			live = false;
		};
	}, [dir, posting]);

	// The description first, whatever it is called, then what was written from it.
	const rows = files
		.map((file) => ({
			file,
			kind: file.path === posting ? ("posting" as Kind) : kindOf(file.path),
			name: readable(file.path),
		}))
		.sort(
			(a, b) =>
				ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) ||
				a.file.path.localeCompare(b.file.path),
		);

	return (
		<section aria-label="Documents" className="flex flex-col gap-2">
			<StripHead label="Documents" reading={rows.length || undefined} />

			{rows.length === 0 ? (
				asked ? (
					<p className="text-muted-foreground text-body leading-[1.45]">
						{dir
							? "The folder is there but empty."
							: "Nothing written for this one yet. /apply is what starts the folder."}
					</p>
				) : (
					<div aria-hidden className="animate-pulse space-y-1">
						<div className="h-9 rounded-key bg-card" />
						<div className="h-9 rounded-key bg-card" />
					</div>
				)
			) : (
				<ul className="flex flex-col gap-1">
					{rows.map(({ file, kind, name }) => (
						<li key={file.path}>
							<button
								type="button"
								onClick={() => onOpen(file.path, name)}
								style={{ "--evt": HUE[KIND[kind].hue] } as React.CSSProperties}
								className="bg-card border border-border rounded-key grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 px-2.5 py-1.5 text-left transition-colors duration-150 ease-out hover:border-border-strong hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal"
							>
								<span className="truncate text-body">{name}</span>
								{/* Sized for the longest label: a truncated chip has stopped being one. */}
								<Chip className="w-[4.75rem]">{KIND[kind].label}</Chip>
								<span className="text-muted-foreground col-span-2 truncate font-data text-data tabular-nums">
									{file.size
										? `${Math.max(1, Math.round(file.size / 1024))} kB · `
										: ""}
									edited {formatDistanceToNow(file.mtime, { addSuffix: true })}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
