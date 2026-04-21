import { TDDNetworking } from "../shared/networking";

function main() {
	for (;;) {
		const tddNetworking = new TDDNetworking(false);
		const thing: number[] = [];
		thing[0] = 1;
		const value = thing[0];

		const time = IO.getNumber(1);
		tddNetworking.update(time);
	}
}

main();
