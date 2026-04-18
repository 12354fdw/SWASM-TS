/*
 OUTPUT: 
	BOOL1: send/recv

 INPUT:
	NUM1: Time
 */

import { IO } from "../../compiler/swasm";

const timeDivision: number = 0.0001;

export class TDDNetworking {
	constructor(private readonly inverted: boolean) {}

	public update(time: number) {
		const shouldSend = this.inverted !== (time % timeDivision === 0);
		IO.setBool(1, shouldSend);
	}
}
