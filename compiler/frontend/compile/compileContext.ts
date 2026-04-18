import ts from "typescript";
import { FuncIR, ClassIR, IRBuilder } from "../../ir";
import { NamespaceRegistry } from "../registerphase";

export class CompileContext {
	public localNames = new Set<string>();
	public currFunc: FuncIR | null = null;
	public currClass: ClassIR | null = null;
	public namespaceStack: string[] = [];

	constructor(
		public readonly registry: NamespaceRegistry,
		public readonly checker: ts.TypeChecker,
		public readonly irBuilder: IRBuilder,
	) {}

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
