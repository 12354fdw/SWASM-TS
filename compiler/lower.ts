import { Emitter } from "./emitter";
import { ClassIR, Expr, FuncIR, Stmt, SWTypes } from "./ir";
import { Op } from "./opcode";

/*
	Functions/Methods ABI:
	the parameters are inputted in the stack.
	the latest value is the first parameter.

	the function is expected to clean the stack or push outputs out into the stack
	the latest value is either first output or cleaned stack

	Class ABI:
	Classes are just tables stored.
	A field is a table access
	A method is a table access to get the function pointer and then call
*/

export class Lowerer {
	private emitter = new Emitter();

	private locals = new Map<string, number>();
	private localCount = 1;

	private labelCatagoryCounter = new Map<string, number>();

	public lower(classes: ClassIR[], functions: FuncIR[]): string {
		// CALL __main
		this.emitter.emitComment("CALL to topLevel code (__main)");
		this.emitter.emitWithOperand(Op.CALL, "__main");
		this.emitter.emit(Op.UNREACHABLE);

		for (const fn of functions) {
			this.lowerFunction(fn);
		}

		this.lowerClasses(classes);

		return this.emitter.serialize();
	}

	private lowerClasses(classes: ClassIR[]) {
		for (const cls of classes) {
			this.lowerClass(cls);
		}
	}

	private lowerClass(cls: ClassIR) {
		// creates the constructor
		const ctorLabel = cls.name + "_ctor";
		this.emitter.emitLabel(ctorLabel);

		const savedLocals = new Map(this.locals);
		const savedCount = this.localCount;

		if (cls.constructorParams.length > 0) {
			this.locals.clear();
			this.localCount = 1;
			for (let i = cls.constructorParams.length - 1; i >= 0; i--) {
				const idx = i + 1;
				this.locals.set(cls.constructorParams[i], idx);
				this.emitter.emitWithOperand(Op.LOCAL_SET, idx);
			}
		}

		this.emitter.emit(Op.TABLE_NEW);

		// fields
		cls.fields.forEach((field: { name: string; idx: number; type: SWTypes; defaultValue?: Expr }) => {
			this.emitter.emitComment(`Field generation of ${cls.name}.${field.name} = ${field.defaultValue}`);
			this.emitter.emit(Op.DUP);

			if (field.defaultValue) {
				this.lowerExpr(field.defaultValue);
			} else {
				this.emitter.emitWithOperand(Op.PUSH_N, 0);
			}

			this.emitter.emitWithOperand(Op.TABLE_SET, field.idx);

			this.emitter.emitBreak();
		});

		// methods
		cls.methods.forEach((method: { name: string; func: FuncIR; idx: number; methodName: string }) => {
			this.emitter.emitComment(`Method generation of ${cls.name}.${method.name}`);
			this.emitter.emit(Op.DUP);
			this.emitter.emitWithOperand(Op.PUSH_N, method.func.label);
			this.emitter.emitWithOperand(Op.TABLE_SET, method.idx);

			this.emitter.emitBreak();
		});

		// constructor
		if (cls.constructorParams && cls.constructorParams.length > 0) {
			this.emitter.emitComment(`call constructor body`);
			this.emitter.emit(Op.DUP);

			// push original ctor args from locals
			for (let i = 0; i < cls.constructorParams.length; i++) {
				this.emitter.emitWithOperand(Op.LOCAL_GET, i + 1);
			}

			this.emitter.emitWithOperand(Op.CALL, `${cls.name}__CONSTRUCTOR`);
		}

		this.locals = savedLocals;
		this.localCount = savedCount;

		this.emitter.emit(Op.RETURN);
	}

	private lowerFunction(fn: FuncIR) {
		this.emitter.emitLabel(fn.name);

		this.locals.clear();
		this.localCount = 1;

		// assign param to locals
		for (const param of fn.params) {
			this.locals.set(param, this.localCount++);
		}

		// push parameters into local
		for (let i = fn.params.length - 1; i >= 0; i--) {
			const idx = this.safeGetLocal(fn.params[i])!;
			this.emitter.emitWithOperand(Op.LOCAL_SET, idx);
		}

		// compile the body
		for (const stmt of fn.body) {
			this.lowerStatement(stmt);
		}

		if (fn.returnedType) return;
		this.emitter.emit(Op.RETURN);
	}

	private lowerStatement(stmt: Stmt) {
		switch (stmt.type) {
			case "let": {
				this.emitter.emitComment(`let '${stmt.name}' as a local`);
				const idx = this.allocLocal(stmt.name);
				this.lowerExpr(stmt.value);
				this.emitter.emitWithOperand(Op.LOCAL_SET, idx);

				this.emitter.emitBreak();
				break;
			}

			case "expr": {
				this.lowerExpr(stmt.expr);
				this.emitter.emit(Op.POP); // discard lol
				break;
			}

			case "return": {
				for (const v of stmt.values) {
					this.lowerExpr(v);
				}
				this.emitter.emit(Op.RETURN);

				stmt.fn.returnedType = true;

				this.emitter.emitBreak();
				break;
			}

			case "if": {
				const elseLabel = this.newLabel("IF_ELSE");
				const endLabel = this.newLabel("IF_END");

				this.lowerExpr(stmt.cond);
				this.emitter.emitWithOperand(Op.JF, elseLabel);

				for (const s of stmt.then) {
					this.lowerStatement(s);
				}
				this.emitter.emitWithOperand(Op.JMP, endLabel);

				this.emitter.emitLabel(elseLabel);

				if (stmt.else) {
					for (const s of stmt.else) {
						this.lowerStatement(s);
					}
				}

				this.emitter.emitLabel(endLabel);

				this.emitter.emitBreak();
				break;
			}

			case "out_bool":
				this.lowerExpr(stmt.expr);
				this.emitter.emitWithOperand(Op.OUT_BOOL, stmt.channel);

				this.emitter.emitBreak();
				break;
			case "out_num":
				this.lowerExpr(stmt.expr);
				this.emitter.emitWithOperand(Op.OUT_NUM, stmt.channel);

				this.emitter.emitBreak();
				break;

			case "while": {
				const startLabel = this.newLabel("WHILE_START");
				const endLabel = this.newLabel("WHILE_END");

				this.emitter.emitLabel(startLabel);

				this.lowerExpr(stmt.cond);
				this.emitter.emitWithOperand(Op.JF, endLabel);

				for (const s of stmt.body) {
					this.lowerStatement(s);
				}

				this.emitter.emitWithOperand(Op.JMP, startLabel);

				this.emitter.emitLabel(endLabel);

				this.emitter.emitBreak();
				break;
			}

			case "local_assign": {
				this.lowerExpr(stmt.value);

				this.emitter.emitComment(`local assign for '${stmt.name}'`);
				this.emitter.emitWithOperand(Op.LOCAL_SET, this.safeGetLocal(stmt.name));

				this.emitter.emitBreak();
				break;
			}
			case "global_assign": {
				this.lowerExpr(stmt.value);

				this.emitter.emitComment(`global assign for '${stmt.ref.name}'`);
				this.emitter.emitWithOperand(Op.GLOBAL_SET, stmt.ref.idx);

				this.emitter.emitBreak();
				break;
			}
			case "field_assign": {
				this.lowerExpr(stmt.obj);
				this.lowerExpr(stmt.value);

				this.emitter.emitComment(`field assign for '${stmt.name}'`);
				this.emitter.emitWithOperand(Op.TABLE_SET, stmt.fieldIdx);

				this.emitter.emitBreak();
				break;
			}
		}
	}

	private lowerExpr(expr: Expr) {
		// pain and suffering
		switch (expr.type) {
			case "number":
				this.emitter.emitComment(`number constant of '${expr.value}'`);
				this.emitter.emitWithOperand(Op.PUSH_N, expr.value);

				this.emitter.emitBreak();
				break;

			case "boolean":
				this.emitter.emitComment(`boolean constant of '${expr.value}'`);
				this.emitter.emitWithOperand(Op.PUSH_B, expr.value ? 1 : 0);

				this.emitter.emitBreak();
				break;

			case "local": {
				this.emitter.emitComment(`get local '${expr.name}'`);
				const idx = this.safeGetLocal(expr.name)!;
				if (idx === undefined) throw Error(`Unknown local: ${expr.name}`);

				this.emitter.emitWithOperand(Op.LOCAL_GET, idx);

				this.emitter.emitBreak();
				break;
			}

			case "binary": {
				this.lowerExpr(expr.left);
				this.lowerExpr(expr.right);

				this.emitter.emitComment(`binary operation of ${expr.op}`);
				// fuck you eslint and prettier, this is more compact
				/* eslint-disable prettier/prettier */
				switch (expr.op) {
					case "add": this.emitter.emit(Op.ADD); break;
					case "sub": this.emitter.emit(Op.SUB); break;
					case "mul": this.emitter.emit(Op.MUL); break;
					case "div": this.emitter.emit(Op.DIV); break;
					case "and": this.emitter.emit(Op.AND); break;
					case "band": this.emitter.emit(Op.BAND); break;
					case "bor": this.emitter.emit(Op.BOR); break;
					case "bxor": this.emitter.emit(Op.BXOR); break;
					case "eq": this.emitter.emit(Op.EQ); break;
					case "ge": this.emitter.emit(Op.GE); break;
					case "gt": this.emitter.emit(Op.GT); break;
					case "le": this.emitter.emit(Op.LE); break;
					case "lt": this.emitter.emit(Op.LT); break;
					case "mod": this.emitter.emit(Op.MOD); break;
					case "ne": this.emitter.emit(Op.NE); break;
					case "or": this.emitter.emit(Op.OR); break;
					case "shl": this.emitter.emit(Op.SHL); break;
					case "shr": this.emitter.emit(Op.SHR); break;
					case "assign": {
						if (expr.left.type !== "local") throw Error("Unsupported assignment target");
						this.lowerExpr(expr.right);
						this.emitter.emitWithOperand(Op.LOCAL_SET, this.safeGetLocal(expr.left.name));
						break;
					}
				}
				/* eslint-enable prettier/prettier */

				this.emitter.emitBreak();
				break;
			}

			case "call":
				this.emitter.emitComment(`get parameters for function call ${expr.func.label}()`);
				for (const arg of expr.args) {
					this.lowerExpr(arg);
				}

				this.emitter.emitComment(`function call: ${expr.func.label}()`);
				this.emitter.emitWithOperand(Op.CALL, expr.func.label);

				this.emitter.emitBreak();
				break;

			case "unary": {
				this.lowerExpr(expr.expr);

				this.emitter.emitComment(`unary operation of '${expr.op}'`);
				/* eslint-disable prettier/prettier */
				switch (expr.op) {
					case "bnot": this.emitter.emit(Op.BNOT); break;
					case "bool_to_num": this.emitter.emit(Op.BOOL_TO_NUM); break;
					case "neg": this.emitter.emit(Op.NEG); break;
					case "not": this.emitter.emit(Op.NOT); break;
					case "num_to_bool": this.emitter.emit(Op.NUM_TO_BOOL); break;
				}
				/* eslint-enable prettier/prettier */

				this.emitter.emitBreak();
				break;
			}

			case "in_bool":
				this.emitter.emitWithOperand(Op.IN_BOOL, expr.channel);

				this.emitter.emitBreak();
				break;
			case "in_num":
				this.emitter.emitWithOperand(Op.IN_NUM, expr.channel);

				this.emitter.emitBreak();
				break;

			case "field": {
				this.lowerExpr(expr.obj);

				this.emitter.emitComment(`get field of '${expr.name}'`);
				this.emitter.emitWithOperand(Op.TABLE_GET, expr.fieldIdx);

				this.emitter.emitBreak();
				break;
			}

			case "method_call": {
				this.lowerExpr(expr.obj); // push table

				this.emitter.emitComment(`get output of method ${expr.clazz}.${expr.name}`);

				this.emitter.emitWithOperand(Op.TABLE_GET, expr.methodIdx); // get function pointer
				const tmp = this.allocLocal("__tmp_fnptr");
				this.emitter.emitWithOperand(Op.LOCAL_SET, tmp);
				for (const arg of expr.args) this.lowerExpr(arg); // push args

				this.lowerExpr(expr.obj); // this
				this.emitter.emitWithOperand(Op.LOCAL_GET, tmp);
				this.emitter.emit(Op.CALL_DYN);

				this.emitter.emitBreak();
				break;
			}

			case "global": {
				this.emitter.emitComment(`get global for '${expr.ref.name}'`);
				this.emitter.emitWithOperand(Op.GLOBAL_GET, expr.ref.idx);

				this.emitter.emitBreak();
				break;
			}

			case "new": {
				for (const arg of expr.args) {
					this.lowerExpr(arg);
				}
				this.emitter.emitComment(`calling constructor for ${expr.className}`);
				this.emitter.emitWithOperand(Op.CALL, expr.className + "_ctor");
				break;
			}
		}
	}

	// variable helpers
	private allocLocal(name: string): number {
		const idx = this.localCount++;
		this.locals.set(name, idx);
		return idx;
	}

	private safeGetLocal(name: string) {
		const local = this.locals.get(name);
		if (local === undefined) throw Error(`Undefined local '${name}'!`);
		return local;
	}

	// label helper
	private newLabel(category: string) {
		const count = this.labelCatagoryCounter.get(category) ?? 0;
		this.labelCatagoryCounter.set(category, count + 1);
		return `${category}_${count}`;
	}
}
