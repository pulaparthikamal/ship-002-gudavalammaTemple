import mongoose from 'mongoose';
import { withMongoTransaction } from './mongoose-transaction.util';

describe('withMongoTransaction', () => {
  const originalStartSession = mongoose.startSession;

  afterEach(() => {
    (mongoose as any).startSession = originalStartSession;
    jest.restoreAllMocks();
  });

  it('commits successful lifecycle work inside a session', async () => {
    const session = {
      withTransaction: jest.fn(async (operation: () => Promise<void>) => operation()),
      endSession: jest.fn(),
    };
    (mongoose as any).startSession = jest.fn().mockResolvedValue(session);

    await expect(withMongoTransaction(async (activeSession) => {
      expect(activeSession).toBe(session);
      return 'committed';
    })).resolves.toBe('committed');

    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('propagates failures so Mongo can roll back partial writes', async () => {
    const session = {
      withTransaction: jest.fn(async (operation: () => Promise<void>) => operation()),
      endSession: jest.fn(),
    };
    (mongoose as any).startSession = jest.fn().mockResolvedValue(session);

    await expect(withMongoTransaction(async () => {
      throw new Error('downstream payment posting failed');
    })).rejects.toThrow('downstream payment posting failed');

    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  it('falls back outside production when Mongo does not support transactions', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const session = {
      withTransaction: jest.fn(async () => {
        throw new Error('Transaction numbers are only allowed on a replica set member or mongos');
      }),
      endSession: jest.fn(),
    };
    (mongoose as any).startSession = jest.fn().mockResolvedValue(session);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const operation = jest
      .fn()
      .mockResolvedValueOnce('fallback-result');

    await expect(withMongoTransaction(operation)).resolves.toBe('fallback-result');

    expect(operation).toHaveBeenCalledWith(null);
    expect(session.endSession).toHaveBeenCalledTimes(1);
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('does not fallback in production when transactions are unavailable', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const session = {
      withTransaction: jest.fn(async () => {
        throw new Error('Transaction numbers are only allowed on a replica set member or mongos');
      }),
      endSession: jest.fn(),
    };
    (mongoose as any).startSession = jest.fn().mockResolvedValue(session);

    await expect(withMongoTransaction(jest.fn())).rejects.toThrow('Transaction numbers are only allowed');

    expect(session.endSession).toHaveBeenCalledTimes(1);
    process.env.NODE_ENV = originalNodeEnv;
  });
});
