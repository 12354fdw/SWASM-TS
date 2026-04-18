import ts from "typescript";
import { FuncIR, ClassIR, IRBuilder } from "../../ir";
import { NamespaceRegistry } from "../registerphase";
import { ExprCompiler } from "./exprCompiler";
import { StmtCompiler } from "./stmtCompiler";

export class CompileContext {
	public localNames = new Set<string>();

	public currFunc: FuncIR | null = null;
	public currClass: ClassIR | null = null;

	public namespaceStack: string[] = [];

	public exprCompiler!: ExprCompiler;
	public stmtCompiler!: StmtCompiler;

	public readonly checker: ts.TypeChecker;

	constructor(
		public readonly program: ts.Program,
		public readonly registry: NamespaceRegistry,
		public readonly irBuilder: IRBuilder,
	) {
		this.checker = program.getTypeChecker();
	}

	public getCurrentNS() {
		const key = this.namespaceStack.join("__") || "GLOBAL";
		return this.registry.get(key)!;
	}

	public declareLocal(name: string) {
		this.localNames.add(name);
	}

	public isLocal(name: string): boolean {
		return this.localNames.has(name);
	}

	public resetLocals() {
		this.localNames = new Set();
	}
}
