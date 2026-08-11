import { type RefObject, useCallback, useEffect, useState } from "react";

export type Section = {
	/** Position and words together: a long document repeats its headings. */
	key: string;
	el: HTMLElement;
	text: string;
	depth: number;
};

/**
 * A document's own headings, read back out of the DOM once it has rendered rather than
 * parsed a second time out of the markdown. A second parser is a second opinion: it
 * disagrees with the renderer about fenced code and inline markup, and then the outline
 * points at the wrong section. Reading the rendered headings cannot disagree, and it
 * hands back the elements themselves, so nothing here needs slugs or ids.
 *
 * `docRef` goes on the element holding the rendered document. A ref callback is the
 * signal, not an effect on the text: it fires with the node already populated, and
 * again with null when the document is swapped out, which is exactly the two moments
 * the outline changes.
 */
export function useOutline(scroller: RefObject<HTMLElement | null>) {
	const [sections, setSections] = useState<Section[]>([]);
	const [active, setActive] = useState(0);

	const docRef = useCallback((node: HTMLElement | null) => {
		setActive(0);
		setSections(
			node
				? [...node.querySelectorAll<HTMLElement>("h2, h3")].map(
						(el, index) => ({
							key: `${index}-${el.textContent}`,
							el,
							text: el.textContent ?? "",
							depth: el.tagName === "H3" ? 3 : 2,
						}),
					)
				: [],
		);
	}, []);

	// Which section the reader is in: the last heading that has passed the top of the
	// window. Read on a frame rather than on every scroll event, and off
	// `getBoundingClientRect` rather than an observer, because the question is "which
	// is the last one above a line" and an IntersectionObserver has to be tricked into
	// answering that with margins.
	useEffect(() => {
		const root = scroller.current;
		if (!root || sections.length === 0) return;

		let frame = 0;
		const read = () => {
			frame = 0;
			const line = root.getBoundingClientRect().top + 96;
			let current = 0;
			for (const [index, section] of sections.entries()) {
				if (section.el.getBoundingClientRect().top > line) break;
				current = index;
			}
			// The last section is usually shorter than the window, so it would never
			// cross the line on its own.
			if (root.scrollTop + root.clientHeight >= root.scrollHeight - 8) {
				current = sections.length - 1;
			}
			setActive(current);
		};

		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(read);
		};
		read();
		root.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			root.removeEventListener("scroll", onScroll);
			if (frame) cancelAnimationFrame(frame);
		};
	}, [scroller, sections]);

	return { sections, active, docRef };
}
