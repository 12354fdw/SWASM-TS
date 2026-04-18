import ts from "typescript";
import { FuncIR, ClassIR, IRBuilder } from "../../ir";
import { NamespaceRegistry } from "../registerphase";
import { ExprCompiler } from "./exprCompiler";
import { StmtCompiler } from "./stmtCompiler";
import { FunctionCompiler } from "./functionCompiler";
import { ClassCompiler } from "./classCompiler";
import { ModuleCompiler } from "./moduleCompiler";

export class CompileContext {
	public localScopes: Set<string>[] = [new Set()];

	public currFunc: FuncIR | null = null;
	public currClass: ClassIR | null = null;

	public namespaceStack: string[] = [];

	public readonly checker: ts.TypeChecker;

	public exprCompiler!: ExprCompiler;
	public stmtCompiler!: StmtCompiler;
	public funcCompiler!: FunctionCompiler;
	public classCompiler!: ClassCompiler;
	public moduleCompiler!: ModuleCompiler;

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

	// getters
	public resolveFunction(name: string): FuncIR | null {
		for (const [, ns] of this.registry) {
			for (const [, func] of ns.functions) {
				if (func.name.endsWith(`__${name}`)) return func;
			}
		}
		return null;
	}

	public resolveClass(name: string): ClassIR | null {
		for (const [, ns] of this.registry) {
			for (const [, cls] of ns.classes) {
				if (cls.name.endsWith(`__${name}`)) return cls;
			}
		}
		return null;
	}

	public resolveConstructor(cls: ClassIR): FuncIR | null {
		const label = `${cls.name}__CONSTRUCTOR_IMPL`;
		for (const [, ns] of this.registry) {
			const f = ns.functions.get(label);
			if (f) return f;
		}
		return null;
	}
}
