import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/setup/steps";
import { Textarea } from "@/components/ui/textarea";

/**
 * The three files `/setup` reads a profile out of, and the only three the files API will
 * write. Each one is seeded from its own template when the repo has no copy yet, so a
 * first run starts from the headings rather than from an empty box.
 */
const DOCS = [
	{
		id: "cv",
		label: "Master CV",
		path: "documents/cv/master_cv.md",
		template: "documents/templates/master_cv.md",
		hint: "The long version, kept a little too long on purpose. Every tailored CV is cut out of this one.",
	},
	{
		id: "linkedin",
		label: "LinkedIn",
		path: "documents/linkedin/Profile.md",
		template: "documents/templates/linkedin-profile.md",
		hint: "What the profile says today, not what it should say. The recommendations are the part worth pasting.",
	},
	{
		id: "record",
		label: "Professional record",
		path: "documents/references/professional-record.md",
		template: "documents/templates/professional-record.md",
		hint: "The private long-form account nobody else reads. Write it in the language you think in.",
	},
] as const;

type DocId = (typeof DOCS)[number]["id"];

type Texts = Record<DocId, string>;

const EMPTY: Texts = { cv: "", linkedin: "", record: "" };

async function read(path: string): Promise<string | null> {
	const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
	if (!res.ok) return null;
	const body = (await res.json()) as { text?: string };
	return typeof body.text === "string" ? body.text : null;
}

async function write(path: string, text: string): Promise<void> {
	const res = await fetch("/api/files", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path, text }),
	});
	if (!res.ok) {
		const detail = (await res.json().catch(() => null)) as {
			error?: string;
		} | null;
		throw new Error(detail?.error ?? `POST /api/files failed: ${res.status}`);
	}
}

/**
 * A template minus the note at the top explaining what it is for: everything after its
 * first rule. A template that is all note and no skeleton keeps the note, since prompts
 * to write against beat an empty box.
 */
function skeleton(template: string): string {
	const cut = template.indexOf("\n---\n");
	const body = cut < 0 ? "" : template.slice(cut + 5).trim();
	return body || template.trim();
}

/**
 * The documents step. It writes straight to the repo rather than holding drafts: these
 * files are what `/setup` reads to build the candidate profile, and a draft that only
 * exists in a dialog is a profile Claude cannot see.
 *
 * Saved on blur, and only when the text has moved off what is on disk - so stepping
 * through the wizard without typing leaves the folders exactly as empty as they were.
 */
export function SetupDocuments({
	/** How many of the three are on disk, so the sheet's spine can print it. */
	onWritten,
}: {
	onWritten?: (count: number) => void;
} = {}) {
	const [current, setCurrent] = useState<DocId>("cv");
	const [texts, setTexts] = useState<Texts>(EMPTY);
	/** What the repo holds, so a save is only sent for what actually changed. */
	const [stored, setStored] = useState<Texts>(EMPTY);
	const [state, setState] = useState<"loading" | "ready" | "saving">("loading");

	useEffect(() => {
		let live = true;
		void Promise.all(
			DOCS.map(async (doc) => {
				const held = await read(doc.path);
				if (held !== null) return [doc.id, held, held] as const;
				const template = await read(doc.template);
				return [doc.id, template ? skeleton(template) : "", ""] as const;
			}),
		).then((rows) => {
			if (!live) return;
			setTexts(
				Object.fromEntries(rows.map(([id, shown]) => [id, shown])) as Texts,
			);
			setStored(
				Object.fromEntries(rows.map(([id, , disk]) => [id, disk])) as Texts,
			);
			setState("ready");
		});
		return () => {
			live = false;
		};
	}, []);

	const doc = DOCS.find((entry) => entry.id === current) ?? DOCS[0];
	const dirty = texts[current] !== stored[current];
	const written = DOCS.filter((entry) => stored[entry.id].trim()).length;

	useEffect(() => {
		onWritten?.(written);
	}, [written, onWritten]);

	const save = async () => {
		if (!dirty || state === "loading") return;
		const text = texts[current];
		setState("saving");
		try {
			await write(doc.path, text);
			setStored((prev) => ({ ...prev, [current]: text }));
			toast.success(`Saved ${doc.path}`);
		} catch (error) {
			toast.error("That document did not save", {
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setState("ready");
		}
	};

	return (
		<div className="space-y-2.5">
			<div className="flex flex-wrap gap-1.5">
				{DOCS.map((entry) => (
					<Chip
						key={entry.id}
						on={entry.id === current}
						onClick={() => setCurrent(entry.id)}
					>
						{entry.label}
						{stored[entry.id].trim() && (
							<span className="text-muted-foreground font-data">saved</span>
						)}
					</Chip>
				))}
			</div>

			<p className="text-muted-foreground text-meta leading-[1.45]">
				{doc.hint}
			</p>

			<Textarea
				value={texts[current]}
				disabled={state === "loading"}
				onChange={(e) =>
					setTexts((prev) => ({ ...prev, [current]: e.target.value }))
				}
				// Blur, not a debounce: this is a document, not a note, and a half-typed
				// heading autosaved every 700ms is a worse file than one written on the way
				// out. Switching tab or pressing Next blurs first, so both save.
				onBlur={() => void save()}
				rows={9}
				placeholder={state === "loading" ? "" : "Paste or type it here…"}
				// A step above body, not the smallest step in the build: index.css records
				// what setting a CV in a UI face at label size did to the document page.
				// Source, though, not a rendered document, so it stays out of the serif.
				className="max-h-[19rem] resize-none overflow-y-auto font-data text-title leading-[1.6]"
			/>

			<p className="text-muted-foreground flex items-center justify-between gap-2 text-meta">
				<span className="font-data">{doc.path}</span>
				<span>
					{state === "saving"
						? "saving…"
						: dirty
							? // A first run opens on a template nobody has typed into yet, so
								// "unsaved" here would be claiming an edit that never happened.
								"writes when you click away"
							: stored[current].trim()
								? "saved"
								: "not written yet"}
				</span>
			</p>
		</div>
	);
}
