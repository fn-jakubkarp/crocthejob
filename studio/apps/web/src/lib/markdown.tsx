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
	a: ({ children, href, ...props }) => (
		<a
			href={href}
			target={href?.startsWith("http") ? "_blank" : undefined}
			rel={href?.startsWith("http") ? "noreferrer" : undefined}
			{...props}
		>
			{children}
		</a>
	),
};
