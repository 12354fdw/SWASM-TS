export type DumpMessage = {
	pc: number;
	op: number;
	arg: number | null;
	hlt: boolean;
	stack: Record<string, unknown>;
	locals: Record<string, unknown>;
	globals: Record<string, unknown>;
	cs: Record<string, unknown>;
};

export const state = {
	data: [] as DumpMessage[],
	record: false,
	dumpIdx: 0,
};

export function getDump() {
	return state.data[state.dumpIdx];
}
