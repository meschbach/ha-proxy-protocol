const assert = require('assert');
const {interpret_format, interpret_address, CMD_PROXY, VERSION_2, FAMILY_TCPv4} = require('../../proxy-protocol-v2');

const TOO_SHORT = Symbol("too short");
const WRONG_MAGIC = Symbol("wrong magic");

class InterpterFormatTestHandler {
	tooShort() { return TOO_SHORT; }
	wrongMagic() { return WRONG_MAGIC; }
	connection(details) { return details; }
}

describe("interpret_format", function () {
	describe("given a header too short", function () {
		beforeEach(function () {
			this.result = interpret_format(new Buffer([0,1,2,3]), new InterpterFormatTestHandler());
		});

		it("reports not enough bytes", function () {
			assert.deepEqual(this.result, TOO_SHORT);
		});
	});
	describe("given a header of appropriate length but wrong magic", function () {
		beforeEach(function () {
			this.result = interpret_format(new Buffer([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]), new InterpterFormatTestHandler());
		});

		it("reports wrong magic", function () {
			assert.deepEqual(this.result, WRONG_MAGIC);
		});
	});

	describe("given a header with the right magic but no body", function () {
		beforeEach(function () {
			this.result = interpret_format(new Buffer([
				0x0D, 0x0A, 0x0D, 0x0A, 0x00, 0x0D, 0x0A, 0x51, 0x55, 0x49, 0x54, 0x0A,
				VERSION_2 | CMD_PROXY,
				FAMILY_TCPv4,
				0, 12]), new InterpterFormatTestHandler());
		});

		it("reports not enough bytes", function () {
			assert.deepEqual(this.result, {command: CMD_PROXY, version: VERSION_2, family: FAMILY_TCPv4, header_length: 12});
		});
	});
});

describe("interpretAddress", function () {
	describe("for TCPv4", function () {
		beforeEach(function () {
			this.result = interpret_address({header_length: 12, family: FAMILY_TCPv4}, Buffer.from([10,0,32,84, 192, 168, 64, 91, 0, 16, 0, 18]))
		});

		it( "source address", function () {
			assert.deepEqual(this.result.remoteAddress, "10.0.32.84");
		} )
		it( "source port", function () {
			assert.deepEqual(this.result.remotePort, 16);
		} )

		it( "proxied address", function () {
			assert.deepEqual(this.result.localAddress, "192.168.64.91");
		} )

		it( "proxied port", function () {
			assert.deepEqual(this.result.localPort, 18);
		} )
	});

	describe("for TCPv6", function () {
		xit( "source address" )
		xit( "source port")
		xit( "proxied address")
		xit( "proxied port")
	});

	xdescribe("for another protocol", function () {
		xit( "sets nothing" )
	});
});
