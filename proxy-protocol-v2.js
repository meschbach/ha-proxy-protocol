
// Magic
const MAGIC = Buffer.from([0x0D, 0x0A, 0x0D, 0x0A, 0x00, 0x0D, 0x0A, 0x51, 0x55, 0x49, 0x54, 0x0A]);

//offsets
const FORMAT_MAGIC = 0;
const FORMAT_CMD_VER = FORMAT_MAGIC + MAGIC.length;
const FORMAT_FAMILY = FORMAT_CMD_VER + 1;
const FORMAT_HEADER_LENGTH = FORMAT_FAMILY + 1;
const FORMAT_LENGTH = FORMAT_HEADER_LENGTH + 2;

//Bitmasks
const HIGH_NIBBLE = 0xF0;
const LOW_NIBBLE = 0x0F;

//Commands
const CMD_LOCAL = 0x00;
const CMD_PROXY = 0x01;

//Version 2
const VERSION_2 = 0x20;

//Families
const FAMILY_TCPv4 = 0x11;
const FAMILY_TCPv6 = 0x21;

function interpret_format( buffer, handler, continueWithWrongMagic = false ) {
	// Verify we have enough data
	if( buffer.length < FORMAT_LENGTH ){ return handler.tooShort(buffer); }
	const magic = buffer.slice(FORMAT_MAGIC, MAGIC.length);
	//Validate magic
	const good_magic = MAGIC.equals(magic);
	if( !(good_magic || continueWithWrongMagic) ) { return handler.wrongMagic(buffer); }

	//Extract the command & version
	const cmd_ver = buffer[FORMAT_CMD_VER];
	const command = cmd_ver & LOW_NIBBLE;
	const version = cmd_ver & HIGH_NIBBLE;

	// Extract the family
	const family = buffer[FORMAT_FAMILY];

	//
	const results = {
		command, version, family,
		header_length: buffer.readInt16BE(FORMAT_HEADER_LENGTH)
	}
	return handler.connection(results);
}


function interpret_address( format, buffer ) {
	if( buffer.length != format.header_length ) { throw new Error("Only interpreting completed header");}

	switch( format.family ){
		case FAMILY_TCPv4:
			const sourceIP =  buffer.slice(0,4).join(".");
			const destIP = buffer.slice(4,8).join(".");
			const sourcePort = buffer.slice(8,10).readUInt16BE(0, true);
			const destPort = buffer.slice(10,12).readUInt16BE(0, true);
			return {remoteAddress: sourceIP, remotePort: sourcePort, localAddress: destIP, localPort: destPort};
		default:
		//Do nothing
	}
}

//Result constants
const PROXY_ERROR_TOO_SHORT = Symbol("PROXY_ERROR_TOO_SHORT");
const PROXY_ERROR_BAD_MAGIC = Symbol("PROXY_ERROR_BAD_MAGIC");

//TODO: Figure out how to make this better
function consume_proxy_protocol( clientSocket, id, handler, logger ){
	clientSocket.once('data', function( chunk ){
		clientSocket.pause();

		const format = interpret_format(chunk, {
			tooShort: () => {
				logger.trace( "Initial chunk to short", id );
				handler({reason: PROXY_ERROR_TOO_SHORT, chunk}, null);
				return null;
			},
			wrongMagic: () => {
				logger.trace( "Wrong magic", id );
				handler({reason: PROXY_ERROR_BAD_MAGIC, chunk}, null);
				return null;
			},
			connection: ( header ) => {
				logger.trace( "Successful connection", {id, header});
				return header;
			}
		});
		if( !format ) { return; }

		const header_end = FORMAT_HEADER_LENGTH + format.header_length;
		const addressBuffer = chunk.slice(FORMAT_HEADER_LENGTH, header_end);
		const remainder = chunk.slice(header_end);

		const address  = interpret_address( format, addressBuffer );
		handler(null, {format, address, remainder});
	});
	if( clientSocket.isPaused() ) { clientSocket.resume(); }
}


module.exports = {
	MAGIC,

	CMD_LOCAL,
	CMD_PROXY,

	VERSION_2,

	FAMILY_TCPv4,
	FAMILY_TCPv6,

	interpret_format,
	interpret_address,

	PROXY_ERROR_TOO_SHORT,
	PROXY_ERROR_BAD_MAGIC,
	consume_proxy_protocol
};
