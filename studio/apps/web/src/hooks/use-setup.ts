import { createContext, useContext } from "react";

/**
 * What the first run settled, kept for every run after it. Small on purpose: the columns,
 * the sorts and the plate already have their own stores, and the wizard writes those
 * rather than shadowing them. What lives here is only what nothing else owns.
 *
 * The provider is a component and lives next to the wizard - see `components/setup`.
 */
export type Setup = {
	/** Whether the wizard has ever come up. What stops it opening itself twice. */
	seen: boolean;
	/** Every step answered. Until then the rail carries the way back in. */
	done: boolean;
	/**
	 * Whether the local Claude Code is part of this setup. Off means offline: the score,
	 * the fit and the rank breakdown are readings only /rank and /scrape can take, so a
	 * board that will never run them shows their slots to nobody.
	 */
	ai: boolean;
	/** The step to come back to. */
	step: number;
};

export const SETUP_FALLBACK: Setup = {
	seen: false,
	done: false,
	ai: true,
	step: 0,
};

export type SetupStore = {
	setup: Setup;
	save: (patch: Partial<Setup>) => void;
};

/**
 * Context rather than a prop: `ai` is read by a card face, a details panel, the dock and
 * the rail, which is four unrelated layers and would otherwise thread a boolean through
 * every component between the board and a tile.
 */
export const SetupContext = createContext<SetupStore | null>(null);

export function useSetup(): SetupStore {
	const store = useContext(SetupContext);
	if (!store) throw new Error("useSetup used outside SetupProvider");
	return store;
}
