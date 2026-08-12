import { type ReactNode, useMemo } from "react";
import { LS, usePersisted } from "@/hooks/use-persisted";
import {
	SETUP_FALLBACK,
	type Setup,
	SetupContext,
	type SetupStore,
} from "@/hooks/use-setup";

/** The one store behind `useSetup`, mirrored into localStorage like the board's view. */
export function SetupProvider({ children }: { children: ReactNode }) {
	const [setup, setSetup] = usePersisted<Setup>(
		LS.setup,
		SETUP_FALLBACK,
		// A half-written store from an older build reads as its defaults, not as
		// undefined fields the wizard then renders blank.
		(stored) => ({ ...SETUP_FALLBACK, ...stored }),
	);

	const value = useMemo<SetupStore>(
		() => ({
			setup,
			save: (patch) => setSetup((prev) => ({ ...prev, ...patch })),
		}),
		[setup, setSetup],
	);

	return <SetupContext value={value}>{children}</SetupContext>;
}
