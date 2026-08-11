import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { chatApi } from "./server/chat-api.ts";
import { filesApi } from "./server/files-api.ts";
import { jobsApi } from "./server/jobs-api.ts";

// `jobsApi`, `chatApi` and `filesApi` are dev-server plugins, not standalone backends,
// so `bun run dev` is the only process to run.
export default defineConfig({
	plugins: [react(), tailwindcss(), jobsApi(), chatApi(), filesApi()],
	// The repo root is a bun workspace too, so `bun install` from the root hoists
	// node_modules above studio/. Serve from there as well as from studio/.
	server: {
		fs: {
			allow: [
				path.resolve(import.meta.dirname, "../../.."),
				path.resolve(import.meta.dirname, "../.."),
			],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
});
