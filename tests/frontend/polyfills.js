// Polyfills that must be loaded before other modules
import { TextEncoder, TextDecoder } from 'util';

// Set up global polyfills
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Import and set up fetch polyfills
import { fetch, Headers, Request, Response } from 'undici';

global.fetch = fetch;
global.Headers = Headers;
global.Request = Request;
global.Response = Response;

// Import Web Streams API
import { ReadableStream, TransformStream, WritableStream } from 'stream/web';

global.ReadableStream = ReadableStream;
global.TransformStream = TransformStream;
global.WritableStream = WritableStream;