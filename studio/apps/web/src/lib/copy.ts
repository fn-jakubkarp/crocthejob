import { toast } from "sonner";

/**
 * Text to the clipboard, and the one place that says whether it got there.
 *
 * `navigator.clipboard` is absent outside a secure context, and this dev server is one
 * `--host` away from being opened on `http://<lan-ip>:5173`. Reaching straight for
 * `.writeText` there throws where a copy button was pressed rather than failing into
 * the toast, so the check lives here instead of at each of the four buttons that copy
 * something.
 */
export function copyText(text: string, what: string): void {
	const refused = () => toast.error("Clipboard refused");
	if (!navigator.clipboard) {
		refused();
		return;
	}
	void navigator.clipboard
		.writeText(text)
		.then(() => toast.success(`${what} copied`), refused);
}
