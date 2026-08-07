import { envConfig } from './env.config';
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: envConfig.appName,
      version: '1.0.0',
      description: 'API Documentation for Enterprise Node.js Backend',
    },
    servers: [
      {
        url: `http://localhost:${envConfig.port}${envConfig.apiPrefix}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/modules/**/*.docs.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
