declare module 'multer' {
  type RequestHandler = (
    req: unknown,
    res: unknown,
    next: (error?: unknown) => void
  ) => void;

  interface MulterInstance {
    single(fieldName: string): RequestHandler;
  }

  interface MulterStatic {
    (options?: unknown): MulterInstance;
    memoryStorage(): unknown;
  }

  const multer: MulterStatic;
  export default multer;
}
