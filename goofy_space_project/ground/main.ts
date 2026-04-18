import { TDDNetworking } from "../shared/networking";

function main() {
	const tddNetworking = new TDDNetworking(false);

	const time = IO.getNumber(1);
	tddNetworking.update(time);
}

main();
