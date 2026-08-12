import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
// `?raw`, not a parsed import: what this panel is for is showing the file as it is
// written, and re-serialising it through `JSON.stringify` would drop the key order the
// file reads in and reformat every nested block.
import schema from "../../job-schema.json?raw";

/**
 * What an entry in `data/jobs.json` may hold.
 *
 * The board is a view onto a file that `/scrape`, `/rank`, `/apply` and `/outcome` also
 * read and write, and the panel and the card only ever show a chosen few of its fields.
 * This is the rest of it: the shape itself, so a field seen in the raw JSON, or one a
 * skill mentions, has somewhere to be looked up without opening an editor.
 *
 * Read-only, and deliberately the file rather than a rendering of it. A prettified table
 * generated from the schema is one more thing that can disagree with the file.
 */
export function SchemaDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>What an entry can hold</DialogTitle>
					<DialogDescription>
						The shape of one record in{" "}
						<span className="font-data">data/jobs.json</span>. The board writes
						a few of these; the rest belong to the scrape and rank skills and
						are carried through untouched.
					</DialogDescription>
				</DialogHeader>

				{/* Its own scroller, and `overflow-x-auto` on the same box: a long
				    description line must not take the dialog sideways with it. */}
				<div className="bg-background border border-border max-h-[60vh] overflow-auto rounded-key p-3">
					<pre className="font-data text-data leading-[1.55] whitespace-pre">
						{schema}
					</pre>
				</div>

				<div className="flex justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							void navigator.clipboard
								.writeText(schema)
								.then(() => toast.success("Schema copied"))
								.catch(() => toast.error("Clipboard refused"));
						}}
					>
						<Copy className="size-3.5" />
						Copy
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
