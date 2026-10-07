import { afterEach } from 'vitest';

// Several scenarios run a whole simulation in one synchronous step. Back to back, on a slow
// machine, they keep the worker's event loop busy for over a minute, and vitest gives up waiting
// to hear from it ("Timeout calling onTaskUpdate"). Yielding after each step lets it answer.
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));
