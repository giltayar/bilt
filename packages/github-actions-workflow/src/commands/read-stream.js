/**
 * @param {NodeJS.ReadStream} stream
 */
export async function readStream(stream) {
  let buffer = Buffer.from('')

  for await (const chunk of stream) {
    buffer += chunk
  }

  return buffer
}
