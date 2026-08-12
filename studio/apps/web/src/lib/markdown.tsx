import type { Components } from "react-markdown";

/**
 * Only the pieces the surrounding CSS cannot reach. Everything visual is in the `.doc`
 * block in index.css, so the map stays at what needs a different element: a table that
 * has to be able to scroll without taking the page sideways with it, and links that
 * leave the app.
 *
 * Shared by the document reader and the posting on a job page. Both render markdown
 * somebody else wrote - a skill, or the employer - so both need the same two fixes.
 */
export const DOC_COMPONENTS: Components = {
	table: ({ children, ...props }) => (
		<div className="doc-table">
			<table {...props}>{children}</table>
		</div>
	),
	a: ({ children, href, ...props }) => {
		// Protocol-relative too: `//host/path` leaves the app exactly as `https://` does,
		// and the `rel` is the same security property `externalLink` carries, spelled
		// the same way.
		const away = /^(https?:)?\/\//i.test(href ?? "");
		return (
			<a
				href={href}
				target={away ? "_blank" : undefined}
				rel={away ? "noreferrer noopener" : undefined}
				{...props}
			>
				{children}
			</a>
		);
	},
};
