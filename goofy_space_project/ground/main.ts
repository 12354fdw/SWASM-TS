import { TDDNetworking } from "../shared/networking";

function main() {
	for (;;) {
		const tddNetworking = new TDDNetworking(false);

		const time = IO.getNumber(1);
		tddNetworking.update(time);
	}
}

main();
