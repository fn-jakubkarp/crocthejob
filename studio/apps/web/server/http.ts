import type { ServerResponse } from "node:http";
import type { Connect } from "vite";

/** Anything larger is a bug or an attack, not a job entry. */
const BODY_LIMIT = 1_000_000;

export function json(res: ServerResponse, code: number, body: unknown): void {
	const payload = JSON.stringify(body);
	res.statusCode = code;
	res.setHeader("Content-Type", "application/json");
	res.setHeader("Cache-Control", "no-store");
	res.end(payload);
}

export async function readBody(req: Connect.IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > BODY_LIMIT) throw new Error("request body too large");
		chunks.push(chunk as Buffer);
	}
	if (chunks.length === 0) return undefined;
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
