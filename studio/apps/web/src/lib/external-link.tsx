/**
 * The props that turn a base-ui trigger into an external link.
 *
 * Spread into a `Button` or a `ContextMenuItem`: `{...externalLink(job.url)}`. Four
 * places open a posting in a new tab, and this is the one that holds
 * `rel="noreferrer noopener"` - a detail that is a security property, not a style, and
 * one that goes missing the fourth time it is retyped.
 *
 * `nativeButton={false}` travels with it because it has to. base-ui expects a native
 * `<button>` under the trigger unless told otherwise, and warns on every open when the
 * rendered element is an anchor.
 */
export const externalLink = (href: string) => ({
	nativeButton: false,
	// The rule cannot see that base-ui renders the trigger's own children inside this
	// anchor. Every call site has them.
	// biome-ignore lint/a11y/useAnchorContent: children come from the trigger
	render: <a href={href} target="_blank" rel="noreferrer noopener" />,
});
