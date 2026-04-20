import { HAS_OPERAND, Op } from "../opcode";

const OpName = Object.fromEntries(Object.entries(Op).map(([k, v]) => [v, k])) as Record<number, string>;

export class Emitter {
	public code: string[] = [];

	private generateCommentText(comment: string) {
		if (comment === "") return "";
		return ` ; ${comment}`;
	}

	public emit(opcode: number, comment: string = ""): void {
		if (HAS_OPERAND.has(opcode)) throw Error(`Attempted to use emit on an instruction with an operand!`);
		this.code.push(`${OpName[opcode]}${this.generateCommentText(comment)}`);
	}

	public emitWithOperand(opcode: number, operand: number | string, comment: string = ""): void {
		if (!HAS_OPERAND.has(opcode))
			throw Error(`Attempted to use emitWithOperand on an instruction without an operand!`);
		this.code.push(`${OpName[opcode]}, ${operand}${this.generateCommentText(comment)}`);
	}

	public emitLabel(name: string, comment: string = "") {
		this.code.push(`\n${name}:${this.generateCommentText(comment)}`);
	}

	public emitBreak() {
		this.code.push("");
	}

	public emitComment(comment: string) {
		this.code.push(`; ${comment}`);
	}

	public get pc(): number {
		return this.code.length;
	}

	public serialize() {
		return this.code.join("\n");
	}
}
