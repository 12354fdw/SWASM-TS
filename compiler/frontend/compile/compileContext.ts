import ts from "typescript";
import { FuncIR, ClassIR, IRBuilder } from "../../ir";
import { NamespaceRegistry } from "../registerphase";
import { ExprCompiler } from "./exprCompiler";
import { StmtCompiler } from "./stmtCompiler";
import { FunctionCompiler } from "./functionCompiler";
import { ClassCompiler } from "./classCompiler";
import { ModuleCompiler } from "./moduleCompiler";

export class CompileContext {
	exitScope() {
		throw new Error("Method not implemented.");
	}
	public localScopes: Set<string>[] = [new Set()];

	public currFunc: FuncIR | null = null;
	public currClass: ClassIR | null = null;

	public namespaceStack: string[] = [];

	public exprCompiler!: ExprCompiler;
	public stmtCompiler!: StmtCompiler;

	public readonly checker: ts.TypeChecker;
	funcCompiler: FunctionCompiler = new FunctionCompiler(this);
	classCompiler: ClassCompiler = new ClassCompiler(this);
	moduleCompiler: ModuleCompiler = new ModuleCompiler(this);

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
		this.localScopes[this.localScopes.length - 1].add(name);
	}

	public isLocal(name: string): boolean {
		for (let i = this.localScopes.length - 1; i >= 0; i--) {
			if (this.localScopes[i].has(name)) return true;
		}
		return false;
	}

	public resetLocals() {
		this.localScopes = [new Set()];
	}

	// scope begin and end
	public beginScope() {
		this.localScopes.push(new Set());
	}

	public endScope() {
		this.localScopes.pop();
	}
}
