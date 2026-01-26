export class BufferReader {
	private offset = 0;

	constructor(private buffer: Buffer) {}

	// ==========================================
	// Core Reading Methods
	// ==========================================

	/**
	 * Reads an unsigned 8-bit integer.
	 */
	readByte(): number {
		this.checkBounds(1);
		const val = this.buffer.readUInt8(this.offset);
		this.offset += 1;
		return val;
	}

	/**
	 * Reads a raw buffer slice.
	 * @param length Number of bytes to read. If omitted, reads until the end.
	 */
	readBytes(length?: number): Buffer {
		const start = this.offset;
		const end = length !== undefined ? start + length : this.buffer.length;

		if (end > this.buffer.length)
			throw new Error(
				`Out of bounds: wanted ${length}, available ${this.remainingBytes()}`,
			);

		const slice = this.buffer.subarray(start, end);
		this.offset = end;
		return slice;
	}

	// ==========================================
	// Source Engine / GoldSrc (Little Endian)
	// ==========================================

	/**
	 * Reads a signed 32-bit integer (LE).
	 */
	readInt(): number {
		this.checkBounds(4);
		const val = this.buffer.readInt32LE(this.offset);
		this.offset += 4;
		return val;
	}

	/**
	 * Reads a signed 16-bit integer (LE).
	 */
	readShort(): number {
		this.checkBounds(2);
		const val = this.buffer.readInt16LE(this.offset);
		this.offset += 2;
		return val;
	}

	/**
	 * Reads a 64-bit unsigned integer (LE).
	 */
	readLong(): bigint {
		this.checkBounds(8);
		const val = this.buffer.readBigUInt64LE(this.offset);
		this.offset += 8;
		return val;
	}

	/**
	 * Reads a 32-bit float (LE).
	 */
	readFloat(): number {
		this.checkBounds(4);
		const val = this.buffer.readFloatLE(this.offset);
		this.offset += 4;
		return val;
	}

	/**
	 * Reads a Null-Terminated string (Source Engine style).
	 * Reads until 0x00 is found.
	 */
	readString(): string {
		const end = this.buffer.indexOf(0x00, this.offset);
		if (end === -1) return "";
		const str = this.buffer.toString("utf-8", this.offset, end);
		this.offset = end + 1; // Advance past the null byte
		return str;
	}

	// ==========================================
	// Minecraft / Java (Big Endian & VarInt)
	// ==========================================

	/**
	 * Reads an unsigned 16-bit integer (BE).
	 * Useful for Port numbers in Minecraft packets.
	 */
	readUInt16BE(): number {
		this.checkBounds(2);
		const val = this.buffer.readUInt16BE(this.offset);
		this.offset += 2;
		return val;
	}

	/**
	 * Reads a Minecraft Protocol VarInt (Variable-length Integer).
	 * See: https://wiki.vg/Protocol#VarInt_and_VarLong
	 */
	readVarInt(): number {
		let num = 0;
		let shift = 0;
		let byte = 0;

		do {
			byte = this.readByte();
			num |= (byte & 0x7f) << shift;
			shift += 7;

			if (shift > 35) throw new Error("VarInt is too big");
		} while ((byte & 0x80) !== 0);

		return num;
	}

	/**
	 * Reads a Minecraft Protocol String.
	 * Prefixed by a VarInt length, followed by UTF-8 bytes.
	 */
	readVarString(): string {
		const len = this.readVarInt();
		const bytes = this.readBytes(len);
		return bytes.toString("utf-8");
	}

	// ==========================================
	// Utilities
	// ==========================================

	remaining(): boolean {
		return this.offset < this.buffer.length;
	}

	private remainingBytes(): number {
		return this.buffer.length - this.offset;
	}

	private checkBounds(bytesNeeded: number) {
		if (this.offset + bytesNeeded > this.buffer.length) {
			throw new Error(
				`BufferReader Out of Bounds: Need ${bytesNeeded}, Have ${this.remainingBytes()}`,
			);
		}
	}
}
