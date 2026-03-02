/**
 * PGB-1 USB Communication Library
 *
 * Provides a high-level interface for communicating with the Wee Noise Makers
 * PGB-1 pocket groove box via WebUSB (Picoboot protocol).
 *
 * Usage:
 *   <script src="pgb1.js"></script>
 *   <script>
 *     const pgb1 = new PGB1({ log: (msg) => console.log(msg) });
 *     await pgb1.connect();
 *     const metas = await pgb1.readAllSampleMetas();
 *     console.log(metas[0].name, metas[0].sampleLength);
 *     await pgb1.disconnect();
 *   </script>
 *
 * No DOM dependencies. No ES module syntax (works offline via script tags).
 */

// IIFE to keep protocol constants private
(function () {
  'use strict';

  // --- Picoboot Protocol Constants (private) ---
  const PICOBOOT_MAGIC = 0x431fd10b;

  const PC_EXCLUSIVE_ACCESS = 0x01;
  const PC_REBOOT            = 0x02;
  const PC_FLASH_ERASE       = 0x03;
  const PC_READ              = 0x84;
  const PC_WRITE             = 0x05;
  const PC_EXIT_XIP          = 0x06;

  const PICOBOOT_IF_RESET = 0x41;

  const CMD_STRUCT_SIZE = 32;
  const RP_PAGE_SIZE = 256;

  // --- UF2 Constants (private) ---
  const UF2_MAGIC_START0  = 0x0A324655;
  const UF2_MAGIC_START1  = 0x9E5D5157;
  const UF2_MAGIC_END     = 0x0AB16F30;
  const UF2_FLAG_FAMILY   = 0x00002000;
  const UF2_FAMILY_RP2040 = 0xE48BFF56;
  const UF2_PAYLOAD_SIZE  = 256;
  const UF2_BLOCK_SIZE    = 512;

  /**
   * PGB-1 USB communication class.
   *
   * @param {Object} [options]
   * @param {function(string): void} [options.log] - Optional logging callback.
   */
  function PGB1(options) {
    options = options || {};
    this._device = null;
    this._interfaceNum = 0;
    this._outEp = 0;
    this._inEp = 0;
    this._token = 1;
    this._busy = false;
    this._log = options.log || function () {};
  }

  // --- Device / Sample Constants (static) ---

  /** USB Vendor ID for Raspberry Pi */
  PGB1.VENDOR_ID = 0x2e8a;
  /** USB Product ID for RP2040 bootloader */
  PGB1.PRODUCT_ID_RP2040 = 0x0003;
  /** USB Product ID for RP2350 bootloader */
  PGB1.PRODUCT_ID_RP2350 = 0x000f;

  /** Flash base address of the sample library */
  PGB1.SAMPLE_LIBRARY_BASE = 276824064; // 0x10800000
  /** Total bytes per sample slot */
  PGB1.SAMPLE_SIZE = 131072;
  /** Bytes of 16-bit signed PCM audio data per sample */
  PGB1.AUDIO_DATA_SIZE = 131054;
  /** Max length of sample name in bytes */
  PGB1.SAMPLE_NAME_SIZE = 14;
  /** Size of sample length field in bytes */
  PGB1.SAMPLE_LENGTH_SIZE = 4;
  /** Number of sample slots */
  PGB1.MAX_SAMPLES = 64;
  /** Audio sample rate in Hz */
  PGB1.SAMPLE_RATE = 32000;
  /** Maximum number of audio samples (frames) that fit in one slot */
  PGB1.MAX_SAMPLES_COUNT = Math.floor(PGB1.AUDIO_DATA_SIZE / 2);

  // --- Private Methods ---

  /**
   * Build a Picoboot command packet.
   * @private
   */
  PGB1.prototype._buildCmd = function (cmdId, params) {
    params = params || {};
    var buf = new ArrayBuffer(CMD_STRUCT_SIZE);
    var view = new DataView(buf);

    view.setUint32(0, PICOBOOT_MAGIC, true);
    view.setUint32(4, this._token++, true);
    view.setUint8(8, cmdId);
    view.setUint8(9, params.cmdSize || 0);
    view.setUint32(12, params.transferLength || 0, true);

    if (params.addr !== undefined) {
      view.setUint32(16, params.addr, true);
    }
    if (params.size !== undefined) {
      view.setUint32(20, params.size, true);
    }
    if (params.exclusive !== undefined) {
      view.setUint8(16, params.exclusive);
    }
    if (params.delayMs !== undefined) {
      view.setUint32(24, params.delayMs, true);
    }

    return new Uint8Array(buf);
  };

  /**
   * Recover from a USB endpoint stall.
   * @private
   */
  PGB1.prototype._recoverFromStall = async function () {
    this._log('Recovering from stall...');
    try { await this._device.clearHalt('in', this._inEp); } catch (_) {}
    try { await this._device.clearHalt('out', this._outEp); } catch (_) {}
    await this._reset();
  };

  /**
   * Send a Picoboot command and handle data transfer + ACK.
   * @private
   */
  PGB1.prototype._sendCmd = async function (cmdId, params, dataOut) {
    params = params || {};
    var cmd = this._buildCmd(cmdId, params);

    var result = await this._device.transferOut(this._outEp, cmd);
    if (result.status === 'stall') {
      await this._recoverFromStall();
      throw new Error('Command send failed: stall (recovered)');
    }

    var dataIn = null;
    var transferLen = params.transferLength || 0;

    if (transferLen > 0) {
      if (cmdId & 0x80) {
        result = await this._device.transferIn(this._inEp, transferLen);
        if (result.status === 'stall') {
          await this._recoverFromStall();
          throw new Error('Data IN failed: stall (recovered)');
        }
        dataIn = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
      } else {
        result = await this._device.transferOut(this._outEp, dataOut);
        if (result.status === 'stall') {
          await this._recoverFromStall();
          throw new Error('Data OUT failed: stall (recovered)');
        }
      }
    }

    // ACK
    if (cmdId & 0x80) {
      await this._device.transferOut(this._outEp, new Uint8Array(0));
    } else {
      await this._device.transferIn(this._inEp, 64);
    }

    return dataIn;
  };

  /**
   * Reset the Picoboot interface.
   * @private
   */
  PGB1.prototype._reset = async function () {
    try { await this._device.clearHalt('in', this._inEp); } catch (_) {}
    try { await this._device.clearHalt('out', this._outEp); } catch (_) {}

    await this._device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'interface',
      request: PICOBOOT_IF_RESET,
      value: 0,
      index: this._interfaceNum,
    });
    this._log('Interface reset');
  };

  /**
   * Acquire a USB operation lock to prevent concurrent access.
   * @private
   * @param {function(): Promise<*>} fn - Async function to run while locked.
   * @returns {Promise<*>} The return value of fn, or null if busy.
   */
  PGB1.prototype._usbLock = async function (fn) {
    if (this._busy) {
      this._log('USB busy, please wait...');
      return null;
    }
    this._busy = true;
    try {
      return await fn();
    } finally {
      this._busy = false;
    }
  };

  /**
   * Request or release exclusive access to the device flash.
   * @private
   * @param {boolean} exclusive - true to acquire, false to release.
   * @returns {Promise<void>}
   */
  PGB1.prototype._exclusiveAccess = async function (exclusive) {
    await this._sendCmd(PC_EXCLUSIVE_ACCESS, {
      cmdSize: 1,
      exclusive: exclusive ? 1 : 0,
    });
    this._log('Exclusive access: ' + exclusive);
  };

  /**
   * Exit XIP (execute-in-place) mode so flash can be read/written directly.
   * @private
   * @returns {Promise<void>}
   */
  PGB1.prototype._exitXIP = async function () {
    await this._sendCmd(PC_EXIT_XIP, { cmdSize: 0 });
    this._log('Exit XIP');
  };

  /**
   * Read data from a flash address.
   * Handles RP2040 page alignment and chunked reads automatically.
   * @private
   * @param {number} addr - Flash address to read from.
   * @param {number} len - Number of bytes to read.
   * @returns {Promise<Uint8Array>} The read data.
   */
  PGB1.prototype._read = async function (addr, len) {
    var alignedAddr = addr & ~(RP_PAGE_SIZE - 1);
    var alignedEnd = (addr + len + RP_PAGE_SIZE - 1) & ~(RP_PAGE_SIZE - 1);
    var alignedLen = alignedEnd - alignedAddr;
    var startOffset = addr - alignedAddr;

    var chunks = [];
    var CHUNK_SIZE = 0x10000; // 64KB

    for (var offset = 0; offset < alignedLen; offset += CHUNK_SIZE) {
      var chunkLen = Math.min(CHUNK_SIZE, alignedLen - offset);
      var data = await this._sendCmd(PC_READ, {
        cmdSize: 8,
        addr: alignedAddr + offset,
        size: chunkLen,
        transferLength: chunkLen,
      });
      chunks.push(data);
    }

    var aligned = new Uint8Array(alignedLen);
    var pos = 0;
    for (var i = 0; i < chunks.length; i++) {
      aligned.set(chunks[i], pos);
      pos += chunks[i].length;
    }

    return aligned.slice(startOffset, startOffset + len);
  };

  /**
   * Write data to a flash address.
   * Data is sent in 4KB chunks (flash page aligned).
   * Flash must be erased before writing.
   * @private
   * @param {number} addr - Flash address to write to.
   * @param {Uint8Array} data - Data to write.
   * @returns {Promise<void>}
   */
  PGB1.prototype._write = async function (addr, data) {
    var CHUNK_SIZE = 0x1000; // 4KB

    for (var offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      var chunkLen = Math.min(CHUNK_SIZE, data.length - offset);
      var chunk = data.slice(offset, offset + chunkLen);
      await this._sendCmd(PC_WRITE, {
        cmdSize: 8,
        addr: addr + offset,
        size: chunkLen,
        transferLength: chunkLen,
      }, chunk);
    }
  };

  /**
   * Erase a region of flash memory.
   * @private
   * @param {number} addr - Flash address to erase from.
   * @param {number} len - Number of bytes to erase.
   * @returns {Promise<void>}
   */
  PGB1.prototype._flashErase = async function (addr, len) {
    await this._sendCmd(PC_FLASH_ERASE, {
      cmdSize: 8,
      addr: addr,
      size: len,
    });
    this._log('Flash erase: 0x' + addr.toString(16) + ' + 0x' + len.toString(16));
  };

  /**
   * Calculate the flash address for a sample slot.
   * @private
   * @param {number} id - Sample slot ID (1-based, 1 to MAX_SAMPLES).
   * @returns {number} Flash address.
   */
  PGB1.prototype._sampleAddr = function (id) {
    return PGB1.SAMPLE_LIBRARY_BASE + (id - 1) * PGB1.SAMPLE_SIZE;
  };

  /**
   * Read only the metadata (name + length) for a sample slot.
   * Requires exclusive access and XIP exit beforehand.
   * @private
   * @param {number} id - Sample slot ID (1-based).
   * @returns {Promise<{id: number, name: string, sampleLength: number, isEmpty: boolean}>}
   */
  PGB1.prototype._readSampleMeta = async function (id) {
    var addr = this._sampleAddr(id);
    var metaAddr = addr + PGB1.AUDIO_DATA_SIZE;
    var metaData = await this._read(metaAddr, PGB1.SAMPLE_NAME_SIZE + PGB1.SAMPLE_LENGTH_SIZE);

    var name = '';
    for (var i = 0; i < PGB1.SAMPLE_NAME_SIZE; i++) {
      if (metaData[i] === 0) break;
      name += String.fromCharCode(metaData[i]);
    }
    name = name.trim();

    var lenView = new DataView(metaData.buffer, metaData.byteOffset + PGB1.SAMPLE_NAME_SIZE, 4);
    var sampleLength = lenView.getUint32(0, true);

    var isEmpty = sampleLength === 0 || sampleLength > PGB1.MAX_SAMPLES_COUNT || sampleLength === 0xFFFFFFFF;

    return { id: id, name: name, sampleLength: sampleLength, isEmpty: isEmpty };
  };

  /**
   * Acquire USB lock, exclusive access, exit XIP, run fn, release exclusive access.
   * Returns null if USB is busy. Ensures exclusive access is released on error.
   *
   * Exiting XIP (execute-in-place) mode is required before any direct flash
   * read/write. Releasing exclusive access at the end implicitly restores
   * XIP mode, so there is no need to re-enter it explicitly.
   * @private
   * @param {function(): Promise<*>} fn - Async function to run with flash access.
   * @returns {Promise<*>} The return value of fn, or null if busy.
   */
  PGB1.prototype._withFlashAccess = async function (fn) {
    return await this._usbLock(async () => {
      try {
        await this._exclusiveAccess(true);
        await this._exitXIP();
        var result = await fn();
        await this._exclusiveAccess(false);
        return result;
      } catch (e) {
        try { await this._exclusiveAccess(false); } catch (_) {}
        throw e;
      }
    });
  };

  // --- Public Methods ---

  /**
   * Whether the device is currently connected.
   * @type {boolean}
   */
  Object.defineProperty(PGB1.prototype, 'connected', {
    get: function () {
      return this._device !== null;
    }
  });

  /**
   * The product name of the connected device.
   * @type {string}
   */
  Object.defineProperty(PGB1.prototype, 'deviceName', {
    get: function () {
      return (this._device && this._device.productName) || 'PGB-1';
    }
  });

  /**
   * The raw WebUSB device object (for disconnect event matching).
   * @type {USBDevice|null}
   */
  Object.defineProperty(PGB1.prototype, 'device', {
    get: function () {
      return this._device;
    }
  });

  /**
   * Request and connect to a PGB-1 device via WebUSB.
   * Finds the Picoboot interface, claims it, and resets.
   * @returns {Promise<void>}
   * @throws {Error} If no device is selected or connection fails.
   */
  PGB1.prototype.connect = async function () {
    this._device = await navigator.usb.requestDevice({
      filters: [
        { vendorId: PGB1.VENDOR_ID, productId: PGB1.PRODUCT_ID_RP2040 },
        { vendorId: PGB1.VENDOR_ID, productId: PGB1.PRODUCT_ID_RP2350 },
      ]
    });

    await this._device.open();
    this._log('Device opened: ' + (this._device.productName || 'PGB-1'));

    if (this._device.configuration === null) {
      await this._device.selectConfiguration(1);
    }

    var config = this._device.configuration;
    var found = false;

    for (var i = 0; i < config.interfaces.length; i++) {
      var iface = config.interfaces[i];
      var alt = iface.alternate;
      if (alt.interfaceClass === 0xFF && alt.endpoints.length === 2) {
        this._interfaceNum = iface.interfaceNumber;
        for (var j = 0; j < alt.endpoints.length; j++) {
          var ep = alt.endpoints[j];
          if (ep.direction === 'out') this._outEp = ep.endpointNumber;
          if (ep.direction === 'in') this._inEp = ep.endpointNumber;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      var iface = config.interfaces.length > 1 ? config.interfaces[1] : config.interfaces[0];
      this._interfaceNum = iface.interfaceNumber;
      for (var j = 0; j < iface.alternate.endpoints.length; j++) {
        var ep = iface.alternate.endpoints[j];
        if (ep.direction === 'out') this._outEp = ep.endpointNumber;
        if (ep.direction === 'in') this._inEp = ep.endpointNumber;
      }
    }

    await this._device.claimInterface(this._interfaceNum);
    this._log('Claimed interface ' + this._interfaceNum +
              ', OUT ep' + this._outEp + ', IN ep' + this._inEp);

    await this._reset();
  };

  /**
   * Close the USB device connection.
   * @returns {Promise<void>}
   */
  PGB1.prototype.disconnect = async function () {
    if (this._device) {
      try {
        await this._device.close();
      } catch (e) { /* ignore */ }
      this._device = null;
    }
    this._log('Disconnected');
  };

  /**
   * Reboot the device.
   * The USB connection will be lost after this call.
   * @returns {Promise<void>}
   */
  PGB1.prototype.reboot = async function () {
    await this._usbLock(async () => {
      try {
        // Match picotool's reboot sequence:
        // 1. Interface reset (no exclusive access, no exit XIP)
        // 2. Send reboot command with 500ms delay for ACK
        await this._reset();
        await this._sendCmd(PC_REBOOT, {
          cmdSize: 12,
          addr: 0,
          size: 0,
          delayMs: 500,
        });
      } catch (e) {
        // Reboot may cause USB disconnect, which is expected
      }
    });
    this._log('Reboot sent');
  };

  /**
   * Read metadata for all 64 sample slots.
   * Handles USB lock, exclusive access, and XIP exit internally.
   * @returns {Promise<Array<{id: number, name: string, sampleLength: number, isEmpty: boolean}>|null>}
   *   Array of 64 sample metas, or null if USB is busy.
   */
  PGB1.prototype.readAllSampleMetas = async function () {
    var self = this;
    return await this._withFlashAccess(async function () {
      var metas = [];
      for (var id = 1; id <= PGB1.MAX_SAMPLES; id++) {
        self._log('Reading sample #' + id + ' metadata');
        metas.push(await self._readSampleMeta(id));
      }
      self._log('Sample library loaded');
      return metas;
    });
  };

  /**
   * Read the PCM audio bytes for a sample slot.
   * Handles USB lock, exclusive access, and XIP exit internally.
   * @param {number} id - Sample slot ID (1-based).
   * @param {number} sampleLength - Number of audio samples (frames) to read.
   * @returns {Promise<Uint8Array|null>} PCM audio data, or null if USB is busy.
   */
  PGB1.prototype.readSampleAudio = async function (id, sampleLength) {
    var self = this;
    return await this._withFlashAccess(async function () {
      var addr = self._sampleAddr(id);
      var bytesToRead = sampleLength * 2;
      self._log('Reading audio data for sample #' + id + ' (' + bytesToRead + ' bytes)...');
      return await self._read(addr, bytesToRead);
    });
  };

  /**
   * Write a sample to a flash slot (erase + write with progress).
   * Handles USB lock, exclusive access, and XIP exit internally.
   * @param {number} id - Sample slot ID (1-based).
   * @param {Uint8Array} pcmData - 16-bit signed PCM audio data.
   * @param {string} name - Sample name.
   * @param {number} sampleLength - Number of audio samples.
   * @param {function(number): void} [onProgress] - Progress callback (0.0 to 1.0).
   * @returns {Promise<void>}
   */
  PGB1.prototype.writeSample = async function (id, pcmData, name, sampleLength, onProgress) {
    var self = this;
    var sampleData = this.buildSampleData(pcmData, name, sampleLength);
    var addr = this._sampleAddr(id);

    return await this._withFlashAccess(async function () {
      self._log('Uploading sample #' + id + ' "' + name + '" (' + sampleLength + ' samples)...');

      if (onProgress) onProgress(0.05);
      await self._flashErase(addr, PGB1.SAMPLE_SIZE);
      if (onProgress) onProgress(0.10);

      var CHUNK_SIZE = 0x1000;
      var totalChunks = Math.ceil(sampleData.length / CHUNK_SIZE);

      for (var i = 0; i < totalChunks; i++) {
        var offset = i * CHUNK_SIZE;
        var chunkLen = Math.min(CHUNK_SIZE, sampleData.length - offset);
        var chunk = sampleData.slice(offset, offset + chunkLen);

        await self._sendCmd(PC_WRITE, {
          cmdSize: 8,
          addr: addr + offset,
          size: chunkLen,
          transferLength: chunkLen,
        }, chunk);

        if (onProgress) onProgress(0.10 + (i / totalChunks) * 0.90);
      }

      if (onProgress) onProgress(1.0);
      self._log('Uploaded sample #' + id + ' successfully');
    });
  };

  /**
   * Read the full sample library (all 64 slots) as a single binary blob.
   * Handles USB lock, exclusive access, and XIP exit internally.
   * @param {function(number, number): void} [onProgress] - Progress callback (id, total).
   * @returns {Promise<Uint8Array|null>} Full library data, or null if USB is busy.
   */
  PGB1.prototype.readFullLibrary = async function (onProgress) {
    var self = this;
    return await this._withFlashAccess(async function () {
      var totalSize = PGB1.MAX_SAMPLES * PGB1.SAMPLE_SIZE;
      var libraryData = new Uint8Array(totalSize);

      for (var id = 1; id <= PGB1.MAX_SAMPLES; id++) {
        if (onProgress) onProgress(id, PGB1.MAX_SAMPLES);
        var addr = self._sampleAddr(id);
        var data = await self._read(addr, PGB1.SAMPLE_SIZE);
        libraryData.set(data, (id - 1) * PGB1.SAMPLE_SIZE);
      }

      return libraryData;
    });
  };

  /**
   * Parse raw sample data into its components.
   * @param {Uint8Array} data - Raw sample data (SAMPLE_SIZE bytes).
   * @param {number} id - Sample slot ID.
   * @returns {{id: number, name: string, sampleLength: number, audioData: Uint8Array}}
   */
  PGB1.prototype.parseSample = function (data, id) {
    var audioData = data.slice(0, PGB1.AUDIO_DATA_SIZE);

    var nameBytes = data.slice(PGB1.AUDIO_DATA_SIZE, PGB1.AUDIO_DATA_SIZE + PGB1.SAMPLE_NAME_SIZE);
    var name = '';
    for (var i = 0; i < PGB1.SAMPLE_NAME_SIZE; i++) {
      if (nameBytes[i] === 0) break;
      name += String.fromCharCode(nameBytes[i]);
    }

    var lengthView = new DataView(data.buffer, data.byteOffset + PGB1.AUDIO_DATA_SIZE + PGB1.SAMPLE_NAME_SIZE, 4);
    var sampleLength = lengthView.getUint32(0, true);

    return { id: id, name: name.trim(), sampleLength: sampleLength, audioData: audioData };
  };

  /**
   * Build a complete sample data block ready for writing to flash.
   * @param {Uint8Array} pcmData - 16-bit signed PCM audio data.
   * @param {string} name - Sample name (max 14 ASCII characters).
   * @param {number} sampleLength - Number of audio samples (frames).
   * @returns {Uint8Array} Complete sample data (SAMPLE_SIZE bytes).
   */
  PGB1.prototype.buildSampleData = function (pcmData, name, sampleLength) {
    var data = new Uint8Array(PGB1.SAMPLE_SIZE);
    data.fill(0xFF);

    var audioLen = Math.min(pcmData.length, PGB1.AUDIO_DATA_SIZE);
    data.set(pcmData.subarray(0, audioLen), 0);
    for (var i = audioLen; i < PGB1.AUDIO_DATA_SIZE; i++) {
      data[i] = 0;
    }

    var nameBytes = new Uint8Array(PGB1.SAMPLE_NAME_SIZE);
    for (var i = 0; i < Math.min(name.length, PGB1.SAMPLE_NAME_SIZE); i++) {
      nameBytes[i] = name.charCodeAt(i) & 0x7F;
    }
    data.set(nameBytes, PGB1.AUDIO_DATA_SIZE);

    var lenView = new DataView(data.buffer, PGB1.AUDIO_DATA_SIZE + PGB1.SAMPLE_NAME_SIZE, 4);
    lenView.setUint32(0, sampleLength, true);

    return data;
  };

  /**
   * Generate a UF2 file from raw binary data.
   * @param {Uint8Array} data - Binary data to wrap in UF2 format.
   * @param {number} baseAddress - Target flash address for the data.
   * @returns {Uint8Array} UF2 file contents.
   */
  PGB1.prototype.generateUF2 = function (data, baseAddress) {
    var numBlocks = Math.ceil(data.length / UF2_PAYLOAD_SIZE);
    var out = new Uint8Array(numBlocks * UF2_BLOCK_SIZE);
    var view = new DataView(out.buffer);

    for (var i = 0; i < numBlocks; i++) {
      var blockOff = i * UF2_BLOCK_SIZE;
      var dataOff = i * UF2_PAYLOAD_SIZE;
      var payloadLen = Math.min(UF2_PAYLOAD_SIZE, data.length - dataOff);

      view.setUint32(blockOff + 0, UF2_MAGIC_START0, true);
      view.setUint32(blockOff + 4, UF2_MAGIC_START1, true);
      view.setUint32(blockOff + 8, UF2_FLAG_FAMILY, true);
      view.setUint32(blockOff + 12, baseAddress + dataOff, true);
      view.setUint32(blockOff + 16, UF2_PAYLOAD_SIZE, true);
      view.setUint32(blockOff + 20, i, true);
      view.setUint32(blockOff + 24, numBlocks, true);
      view.setUint32(blockOff + 28, UF2_FAMILY_RP2040, true);

      out.set(data.subarray(dataOff, dataOff + payloadLen), blockOff + 32);

      view.setUint32(blockOff + UF2_BLOCK_SIZE - 4, UF2_MAGIC_END, true);
    }

    return out;
  };

  // Expose as global
  window.PGB1 = PGB1;
})();
