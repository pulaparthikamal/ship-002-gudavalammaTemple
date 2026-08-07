import mongoose, { ClientSession } from 'mongoose';

function isTransactionUnsupportedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return [
    'Transaction numbers are only allowed on a replica set member or mongos',
    'This MongoDB deployment does not support retryable writes',
    'Transactions are not supported',
    'Transaction not supported',
  ].some((pattern) => message.includes(pattern));
}

function canFallbackToNonTransactionalMode() {
  return String(process.env.NODE_ENV ?? 'development').trim().toLowerCase() !== 'production';
}

export async function withMongoTransaction<T>(
  operation: (session: ClientSession) => Promise<T>,
  options: { useTransaction?: boolean; fallbackToNonTransactional?: boolean } = {}
): Promise<T> {
  if (options.useTransaction === false) {
    const session = await mongoose.startSession();
    try {
      return await operation(session);
    } finally {
      await session.endSession();
    }
  }

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await operation(session);
    });

    return result as T;
  } catch (error) {
    if (
      options.fallbackToNonTransactional !== false
      && canFallbackToNonTransactionalMode()
      && isTransactionUnsupportedError(error)
    ) {
      console.warn(
        'MongoDB transactions are unavailable in this environment; retrying RCM lifecycle operation without a transaction. Use a Mongo replica set for production.'
      );
      return operation(null as unknown as ClientSession);
    }

    throw error;
  } finally {
    await session.endSession();
  }
}
