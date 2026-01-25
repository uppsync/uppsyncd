export class BufferReader {
	private offset = 0;

	constructor(private buffer: Buffer) {}

	readByte(): number {
		const val = this.buffer.readUInt8(this.offset);
		this.offset += 1;
		return val;
	}

	readShort(): number {
		const val = this.buffer.readInt16LE(this.offset);
		this.offset += 2;
		return val;
	}

	readInt(): number {
		const val = this.buffer.readInt32LE(this.offset);
		this.offset += 4;
		return val;
	}

	readLong(): bigint {
		const val = this.buffer.readBigUInt64LE(this.offset);
		this.offset += 8;
		return val;
	}

	readFloat(): number {
		const val = this.buffer.readFloatLE(this.offset);
		this.offset += 4;
		return val;
	}

	readString(): string {
		const end = this.buffer.indexOf(0x00, this.offset);
		if (end === -1) return "";
		const str = this.buffer.toString("utf-8", this.offset, end);
		this.offset = end + 1;
		return str;
	}

	remaining(): boolean {
		return this.offset < this.buffer.length;
	}
}
