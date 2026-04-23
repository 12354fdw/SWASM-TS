// SWASM Opcode definitions
// Each opcode maps to a float value in the bytecode

export const Op = {
	// Control flow
	NOP: 0,
	UNREACHABLE: 1,
	RETURN: 2,
	CALL: 3, // [CALL, addr]
	JMP: 4, // [JMP, addr]
	JZ: 5, // [JZ, addr]  -- jump if top == 0
	JNZ: 6, // [JNZ, addr]
	JT: 7, // [JT, addr]  -- jump if top == true
	JF: 8, // [JF, addr]  -- jump if top == false

	// Stack
	PUSH_N: 9, // [PUSH_N, value]
	PUSH_B: 10, // [PUSH_B, 0|1]
	POP: 11,
	DUP: 12,
	SWAP: 13,
	SELECT: 14, // pops cond, val2, val1 -- pushes val1 if cond != 0 else val2

	// Variables (both use memory[])
	LOCAL_GET: 15, // [LOCAL_GET, idx]
	LOCAL_SET: 16, // [LOCAL_SET, idx]
	LOCAL_TEE: 17, // [LOCAL_TEE, idx] -- set but keep on stack
	GLOBAL_GET: 18, // [GLOBAL_GET, idx]
	GLOBAL_SET: 19, // [GLOBAL_SET, idx]

	// Memory
	LOAD: 20, // [LOAD, addr]
	STORE: 21, // [STORE, addr]
	LOAD_DYN: 22, // pops addr, pushes memory[addr]
	STORE_DYN: 23, // pops addr, pops value, stores

	// Arithmetic
	ADD: 24,
	SUB: 25,
	MUL: 26,
	DIV: 27,
	MOD: 28,
	ABS: 29,
	NEG: 30,
	SQRT: 31,
	FLOOR: 32,
	CEIL: 33,
	MIN: 34,
	MAX: 35,

	// Comparison (number -> bool)
	EQ: 36,
	NE: 37,
	LT: 38,
	GT: 39,
	LE: 40,
	GE: 41,

	// Logic (bool)
	AND: 42,
	OR: 43,
	NOT: 44,
	XOR: 45,

	// Bitwise
	BAND: 46,
	BOR: 47,
	BXOR: 48,
	BNOT: 49,
	SHL: 50,
	SHR: 51,

	// Type conversion
	NUM_TO_BOOL: 52,
	BOOL_TO_NUM: 53,

	// I/O
	IN_NUM: 54, // [IN_NUM, channel]
	IN_BOOL: 55, // [IN_BOOL, channel]
	OUT_NUM: 56, // [OUT_NUM, channel]
	OUT_BOOL: 57, // [OUT_BOOL, channel]

	// Tables
	TABLE_NEW: 58,
	TABLE_GET: 59, // [TABLE_GET, key]
	TABLE_SET: 60, // [TABLE_SET, key] -- pops table then value
	TABLE_GET_DYN: 61, // STACK ABI: [table,key]
	TABLE_SET_DYN: 62, // STACK ABI: [table,value,key]
	TABLE_LEN: 63,
	TABLE_INSERT: 64,
	TABLE_REMOVE: 65, // [TABLE_REMOVE, idx]

	CALL_DYN: 66,

	// Runtime code manipulation
	//CODE_ADD: 67, // pops the latest 2 values in stack. [address, value] RIGHT IS LATEST. then put in in code staging buffer
	//CODE_COMMIT: 68, // Changes CODE and resets everything to a clean slate, except for memory address 1 to communicate some data over
} as const;

export type OpCode = (typeof Op)[keyof typeof Op];
export const OpName = Object.fromEntries(Object.entries(Op).map(([k, v]) => [v, k])) as Record<number, string>;
