declare module 'bplist-parser' {
  export function parseBuffer(buffer: Buffer | Uint8Array): any[]
  export default {
    parseBuffer: parseBuffer
  }
}

