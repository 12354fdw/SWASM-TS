import { NamespaceRegistry } from "./registerphase";

export class bindPhase {
	constructor(private readonly namespaceRegistry: NamespaceRegistry) {}

	public bind() {
		let idx = 1;
		for (const [, ns] of this.namespaceRegistry) {
			for (const [, global] of ns.globals) {
				global.idx = idx++;
			}
		}
	}
}
