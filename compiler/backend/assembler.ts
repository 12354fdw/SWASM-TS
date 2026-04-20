import { HAS_OPERAND, Op } from "../opcode";

const OpFromName = Op as unknown as Record<string, number>;

export class Assembler {
	private labelMap = new Map<string, number>();

	assemble(source: string): number[] {
		const lines = source.split("\n");

		const clean = lines.map(this.preProcessor).filter((l): l is string => l !== null);

		this.mapLabels(clean);

		return this.emitInstructions(clean);
	}

	private preProcessor(line: string): string | null {
		const noComment = line.split(";")[0];
		const trimmed = noComment.trim();
		if (trimmed === "") return null;
		return trimmed;
	}

	private mapLabels(lines: string[]) {
		let pc = 0;

		for (const line of lines) {
			if (this.isLabel(line)) {
				const label = line.slice(0, -1);
				this.labelMap.set(label, pc);
				continue;
			}

			pc += this.instructionSize(line);
		}
	}

	private emitInstructions(lines: string[]): number[] {
		const output: number[] = [];

		for (const line of lines) {
			if (this.isLabel(line)) continue;

			const { op, operand } = this.parse(line);

			output.push(op);

			if (operand !== undefined) {
				if (typeof operand === "string") {
					const addr = this.labelMap.get(operand);
					if (addr === undefined) {
						throw new Error(`Unknown label: ${operand}`);
					}
					output.push(addr + 1); // lua is 1 indexed
				} else {
					output.push(operand);
				}
			}
		}

		return output;
	}

	// helpers
	private isLabel(line: string): boolean {
		return line.endsWith(":");
	}

	private instructionSize(line: string): number {
		const [name] = line.split(",").map((s) => s.trim());
		const op = OpFromName[name];

		if (op === undefined) {
			throw new Error(`Unknown opcode: '${name}' at line '${line}'`);
		}

		return HAS_OPERAND.has(op) ? 2 : 1;
	}

	private parse(line: string): { op: number; operand?: number | string } {
		const parts = line.split(",").map((s) => s.trim());

		const name = parts[0];
		const op = OpFromName[name];

		if (op === undefined) {
			throw new Error(`Unknown opcode: ${name}`);
		}

		if (HAS_OPERAND.has(op)) {
			if (parts.length < 2) {
				throw new Error(`Missing operand for ${name}`);
			}

			const raw = parts[1];

			// number or label
			const num = Number(raw);
			if (!Number.isNaN(num)) {
				return { op, operand: num };
			}

			return { op, operand: raw }; // label
		}

		return { op };
	}
}
