import { closeSync, constants, fsyncSync, openSync, realpathSync } from "node:fs";
import path from "node:path";
import { getSystemErrorName } from "node:util";
import koffi from "koffi";

const LOCK_EX = 2;
const LOCK_NB = 4;
const EXCHANGE = 2; // Darwin RENAME_SWAP and Linux RENAME_EXCHANGE.

type NativeCalls = {
  flock: (fd: number, flags: number) => number;
  exchange: (fromDir: number, from: string, toDir: number, to: string, flags: number) => number;
};
let native: NativeCalls | undefined;

function nativeCalls(): NativeCalls {
  if (process.platform !== "darwin" && process.platform !== "linux") {
    throw new Error("Vault transactions require the macOS or Linux atomic file exchange adapter.");
  }
  if (!native) {
    const libc = koffi.load(null);
    native = {
      flock: libc.func("int flock(int fd, int flags)"),
      exchange: libc.func(process.platform === "darwin" ? "renameatx_np" : "renameat2", "int", [
        "int",
        "str",
        "int",
        "str",
        "uint",
      ]),
    };
  }
  return native;
}

function nativeError(operation: string, errno: number): Error {
  return new Error(`${operation} failed (${errno > 0 ? getSystemErrorName(-errno) : `errno ${errno}`}).`);
}

export const transactionFs = {
  tryLock(fd: number): boolean {
    if (nativeCalls().flock(fd, LOCK_EX | LOCK_NB) === 0) return true;
    const errno = koffi.errno();
    if (errno === koffi.os.errno.EAGAIN || errno === koffi.os.errno.EWOULDBLOCK) return false;
    throw nativeError("Lock acquisition", errno);
  },

  exchange(file: string, staged: string): void {
    const directory = path.dirname(file);
    if (directory !== path.dirname(staged) || directory !== realpathSync(directory)) {
      throw new Error("Atomic file exchange requires a canonical shared parent directory.");
    }
    const fd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
      if (nativeCalls().exchange(fd, path.basename(file), fd, path.basename(staged), EXCHANGE) !== 0) {
        throw nativeError("Atomic file exchange", koffi.errno());
      }
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  },
};
