// the calculator test

class Calculator {
	constructor(private a: number, private b: number) {}

	public setA(num: number) {
		this.a = num;
	}

	public setB(num: number) {
		this.b = num;
	}

	public add(): number {
		return this.a + this.b;
	}
}

function foo(x: number): number {
	const y = x + 1;
	return y;
}

function main(): number {
	const calc1 = new Calculator(1, 1);
	const calc2 = new Calculator(10, 20);

	const a1 = calc1.add(); // 2
	const a2 = calc2.add(); // 30

	calc1.setA(5);
	calc1.setB(6);
	const a3 = calc1.add(); // 11

	const a4 = calc2.add(); // 30

	const x = foo(a3); // 12

	return x + a1 + a2 + a3 + a4; // 85
}

main();
