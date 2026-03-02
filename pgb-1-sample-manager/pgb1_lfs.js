/**
 * PGB-1 LittleFS Interface
 *
 * Provides read/write access to the littlefs partition on the PGB-1 device.
 * Depends on pgb1.js (PGB1 class) for USB/flash communication and
 * littlefs-js for the filesystem implementation.
 *
 * Usage:
 *   <script src="pgb1.js"></script>
 *   <script src="pgb1_lfs.js"></script>
 *   <script>
 *     const pgb1 = new PGB1({ log: console.log });
 *     const lfs = new PGB1LFS(pgb1);
 *     await pgb1.connect();
 *     const projects = await lfs.listProjects();
 *   </script>
 *
 * No DOM dependencies. No ES module syntax (works offline via script tags).
 */

(function () {
  'use strict';

  // Capture script base URL for dynamic imports (must be at IIFE execution time)
  var _scriptBaseURL = (document.currentScript && document.currentScript.src)
    ? new URL('.', document.currentScript.src).href
    : '';

  /** Flash base address of the littlefs partition */
  var LFS_PARTITION_BASE = 0x10100000;
  /** Block size for the littlefs partition (flash sector size) */
  var LFS_BLOCK_SIZE = 4096;
  /** Number of blocks in the partition (must match PGB-1 firmware config) */
  var LFS_BLOCK_COUNT = 1792;

  /**
   * PGB-1 LittleFS interface.
   *
   * @param {PGB1} pgb1 - A PGB1 instance used for USB/flash communication.
   */
  function PGB1LFS(pgb1) {
    this._pgb1 = pgb1;
    this._lfsModule = null;
  }

  /**
   * Load the littlefs-js module (cached after first call).
   * @private
   * @returns {Promise<Object>} The littlefs-js module exports.
   */
  PGB1LFS.prototype._loadModule = async function () {
    if (!this._lfsModule) {
      this._lfsModule = await import(_scriptBaseURL + 'littlefs-js/lfs_js.js');
    }
    return this._lfsModule;
  };

  /**
   * Create a littlefs BlockDevice backed by PGB-1 flash.
   * Must be called inside a _withFlashAccess callback so that
   * exclusive access and XIP exit are already active.
   * @private
   * @param {Object} lfsModule - The littlefs-js module exports.
   * @returns {BlockDevice}
   */
  PGB1LFS.prototype._createBlockDevice = function (lfsModule) {
    var pgb1 = this._pgb1;
    var LFSModule = lfsModule.LFSModule;

    var bd = new lfsModule.BlockDevice();
    bd.read_size = LFS_BLOCK_SIZE;
    bd.prog_size = LFS_BLOCK_SIZE;
    bd.block_size = LFS_BLOCK_SIZE;
    bd.block_count = LFS_BLOCK_COUNT;

    bd.read = async function (block, off, buffer, size) {
      try {
        var addr = LFS_PARTITION_BASE + block * LFS_BLOCK_SIZE + off;
        var data = await pgb1._read(addr, size);
        LFSModule.HEAPU8.set(data, buffer);
        return 0;
      } catch (e) {
        pgb1._log('LFS read error: ' + e.message);
        return -5; // LFS_ERR_IO
      }
    };

    bd.prog = async function (block, off, buffer, size) {
      try {
        var addr = LFS_PARTITION_BASE + block * LFS_BLOCK_SIZE + off;
        // Copy data out of WASM heap before the async _write call.
        // A mere view into HEAPU8.buffer would become invalid if
        // emscripten grows/replaces the buffer during await.
        var data = LFSModule.HEAPU8.slice(buffer, buffer + size);
        await pgb1._write(addr, data);
        return 0;
      } catch (e) {
        pgb1._log('LFS write error: ' + e.message);
        return -5; // LFS_ERR_IO
      }
    };

    bd.erase = async function (block) {
      try {
        var addr = LFS_PARTITION_BASE + block * LFS_BLOCK_SIZE;
        await pgb1._flashErase(addr, LFS_BLOCK_SIZE);
        return 0;
      } catch (e) {
        pgb1._log('LFS erase error: ' + e.message);
        return -5; // LFS_ERR_IO
      }
    };

    return bd;
  };

  /**
   * Mount the littlefs filesystem, run a callback, then unmount.
   * Handles USB lock, exclusive access, and XIP exit via PGB1._withFlashAccess.
   * @private
   * @param {function(lfs: Object, lfsModule: Object): Promise<*>} fn
   *   Callback receiving the mounted LFS instance and the module exports.
   * @returns {Promise<*>} The return value of fn, or null if USB is busy.
   */
  PGB1LFS.prototype._withMount = async function (fn) {
    var self = this;
    var pgb1 = this._pgb1;

    return await pgb1._withFlashAccess(async function () {
      var lfsModule = await self._loadModule();
      var bd = self._createBlockDevice(lfsModule);
      var lfs = new lfsModule.LFS(bd, -1);

      if (lfs.version() != 0x20003) {
        alert(lfs.version());
      }
      var err = await lfs.mount();
      if (err < 0) {
        throw new Error('Failed to mount littlefs: error ' + err);
      }

      try {
        return await fn(lfs, lfsModule);
      } finally {
        await lfs.unmount();
      }
    });
  };

  /**
   * List all files and directories on the device's littlefs partition.
   * @param {string} [path='/'] - Directory path to list (recursive).
   * @returns {Promise<Array<{name: string, path: string, type: string, size: number}>|null>}
   *   Array of file/directory entries, or null if USB is busy.
   */
  PGB1LFS.prototype.listFiles = async function (path) {
    var pgb1 = this._pgb1;
    path = path || '/';

    return await this._withMount(async function (lfs, lfsModule) {
      var files = [];

      async function listDir(dirPath) {
        var dir = await lfs.opendir(dirPath);
        if (typeof dir === 'number') {
          throw new Error('Failed to open directory ' + dirPath + ': error ' + dir);
        }
        while (true) {
          var entry = await dir.read();
          if (!entry) break;
          if (entry.name === '.' || entry.name === '..') continue;
          var fullPath = dirPath === '/' ? '/' + entry.name : dirPath + '/' + entry.name;
          files.push({
            name: entry.name,
            path: fullPath,
            type: entry.type === lfsModule.LFS_TYPE_DIR ? 'dir' : 'file',
            size: entry.size,
          });
          if (entry.type === lfsModule.LFS_TYPE_DIR) {
            await listDir(fullPath);
          }
        }
        await dir.close();
      }

      await listDir(path);
      pgb1._log('Listed ' + files.length + ' files from littlefs');
      return files;
    });
  };

  /**
   * List all projects stored on the device's littlefs partition.
   * Projects are files in the root directory matching the pattern
   * XX<name>.wnm_prj, where XX is a two-digit id (01-20).
   * @returns {Promise<Array<{id: number, name: string, filename: string, size: number}>|null>}
   *   Array of project entries sorted by id, or null if USB is busy.
   */
  PGB1LFS.prototype.listProjects = async function () {
    var files = await this.listFiles('/');
    if (!files) return null;

    var projects = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f.type !== 'file') continue;
      var match = f.name.match(/^(\d{2})(.*)\.wnm_prj$/);
      if (!match) continue;
      var id = parseInt(match[1], 10);
      if (id < 1 || id > 20) continue;
      projects.push({
        id: id,
        name: match[2].trim(),
        filename: f.name,
        size: f.size,
      });
    }

    projects.sort(function (a, b) { return a.id - b.id; });
    this._pgb1._log('Found ' + projects.length + ' projects');
    return projects;
  };

  /**
   * Read a file from the device's littlefs partition.
   * @param {string} filename - File path (e.g. '/01myproject.wnm_prj').
   * @returns {Promise<Uint8Array|null>} File contents, or null if USB is busy.
   */
  PGB1LFS.prototype.readFile = async function (filename) {
    var pgb1 = this._pgb1;

    return await this._withMount(async function (lfs, lfsModule) {
      var file = await lfs.open(filename, lfsModule.LFS_O_RDONLY);
      if (typeof file === 'number') {
        throw new Error('Failed to open file ' + filename + ': error ' + file);
      }
      try {
        var fileSize = await file.size();
        if (fileSize < 0) {
          throw new Error('Failed to get file size: error ' + fileSize);
        }
        var data = await file.read(fileSize);
        if (typeof data === 'number') {
          throw new Error('Failed to read file: error ' + data);
        }
        pgb1._log('Read ' + data.length + ' bytes from ' + filename);
        return data;
      } finally {
        await file.close();
      }
    });
  };

  /**
   * Write a file to the device's littlefs partition.
   * @param {string} filename - File path (e.g. '/01myproject.wnm_prj').
   * @param {Uint8Array} data - File contents to write.
   * @returns {Promise<boolean|null>} true on success, or null if USB is busy.
   */
  PGB1LFS.prototype.writeFile = async function (filename, data) {
    var pgb1 = this._pgb1;

    return await this._withMount(async function (lfs, lfsModule) {
      var flags = lfsModule.LFS_O_WRONLY | lfsModule.LFS_O_CREAT | lfsModule.LFS_O_TRUNC;
      var file = await lfs.open(filename, flags);
      if (typeof file === 'number') {
        throw new Error('Failed to open file ' + filename + ' for writing: error ' + file);
      }
      try {
        var written = await file.write(data);
        if (typeof written === 'number' && written < 0) {
          throw new Error('Failed to write file: error ' + written);
        }
        pgb1._log('Wrote ' + data.length + ' bytes to ' + filename);
        return true;
      } finally {
        await file.close();
      }
    });
  };

  /**
   * Delete a file from the device's littlefs partition.
   * @param {string} filename - File path (e.g. '/01myproject.wnm_prj').
   * @returns {Promise<boolean|null>} true on success, or null if USB is busy.
   */
  PGB1LFS.prototype.deleteFile = async function (filename) {
    var pgb1 = this._pgb1;

    return await this._withMount(async function (lfs) {
      var err = await lfs.remove(filename);
      if (err < 0) {
        throw new Error('Failed to delete file ' + filename + ': error ' + err);
      }
      pgb1._log('Deleted ' + filename);
      return true;
    });
  };

  // Expose as global
  window.PGB1LFS = PGB1LFS;
})();
