import { Lowerer } from "./backend/lower";

export type SWTypes = "number" | "boolean" | "table";

export type Variable = {
	name: string;
	type: SWTypes;
};

type binary_operations =
	| "add"
	| "sub"
	| "mul"
	| "div"
	| "mod"
	| "eq"
	| "ne"
	| "lt"
	| "gt"
	| "le"
	| "ge"
	| "and"
	| "or"
	| "band"
	| "bor"
	| "bxor"
	| "shl"
	| "shr"
	| "assign";

type unary_operations = "neg" | "not" | "bnot" | "num_to_bool" | "bool_to_num";
// FYI: NEGATE IS INVERTING SIGN
// 		NOT IS INVERTING BOOLEANS

export type Expr =
	| { type: "number"; value: number }
	| { type: "boolean"; value: boolean }
	| { type: "local"; name: string }
	| { type: "binary"; op: binary_operations; left: Expr; right: Expr }
	| { type: "unary"; op: unary_operations; expr: Expr }
	| { type: "call"; func: FuncIR; args: Expr[] }
	| { type: "global"; ref: GlobalIR }
	| { type: "field"; obj: Expr; name: string; fieldIdx: number }
	| { type: "in_num"; channel: number }
	| { type: "in_bool"; channel: number }
	| { type: "new"; className: string; ctorLabel: string; args: Expr[] }
	| { type: "method_call"; obj: Expr; clazz: string; name: string; methodIdx: number; args: Expr[] }
	| { type: "new_array"; init: Expr[] }
	| { type: "read_array"; array: Expr; idx: Expr };

export type Stmt =
	| { type: "let"; name: string; value: Expr }
	| { type: "expr"; expr: Expr }
	| { type: "return"; values: Expr[]; fn: FuncIR }
	| { type: "if"; cond: Expr; then: Stmt[]; else?: Stmt[] }
	| { type: "while"; cond: Expr; body: Stmt[] }
	| { type: "out_num"; expr: Expr; channel: number }
	| { type: "out_bool"; expr: Expr; channel: number }
	| { type: "local_assign"; name: string; value: Expr }
	| { type: "global_assign"; ref: GlobalIR; value: Expr }
	| { type: "field_assign"; obj: Expr; fieldIdx: number; value: Expr; name: string }
	| { type: "array_assign"; array: Expr; idx: Expr; value: Expr };

export type FuncIR = {
	name: string;
	label: string;

	params: string[];
	returns: SWTypes[];

	body: Stmt[];

	returnedType: boolean; // used in lower phase
};

export type ClassIR = {
	name: string;
	fields: Map<string, { name: string; idx: number; type: SWTypes; defaultValue?: Expr }>;
	methods: Map<string, { name: string; func: FuncIR; idx: number; methodName: string }>;
	parent?: string;
	constructorParams: string[];
	ctorLabel: string;
};

export type GlobalIR = {
	name: string;
	idx: number; // decided in bind phase
};

export class IRBuilder {
	public functions: FuncIR[] = [];
	public classes: ClassIR[] = [];
	public globals: GlobalIR[] = [];

	public addFunction(func: FuncIR) {
		this.functions.push(func);
	}

	public addClass(clazz: ClassIR) {
		this.classes.push(clazz);
	}

	public addGlobal(global: GlobalIR) {
		this.globals.push(global);
	}

	public lower(): string {
		const lowerer = new Lowerer();
		return lowerer.lower(this.classes, this.functions);
	}
}
