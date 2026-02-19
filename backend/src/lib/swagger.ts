import swaggerJSDoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DMZ Secure App API',
      version: '1.0.0',
      description:
        'REST API for the DMZ Secure App. Protected endpoints require a Bearer JWT obtained from `POST /api/auth/token`.',
    },
    servers: [
      {
        url: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
        description: 'Current server',
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
      responses: {
        Unauthorized: {
          description: 'Missing or invalid JWT',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Unauthorized: invalid or expired token' },
                },
              },
            },
          },
        },
        Forbidden: {
          description: 'Authenticated but role does not permit this endpoint',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Forbidden: your role does not have access to this endpoint' },
                  endpoint: { type: 'string' },
                  method: { type: 'string' },
                },
              },
            },
          },
        },
      },
      schemas: {
        Role: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Admin User' },
            description: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            endpointMappings: {
              type: 'array',
              items: { $ref: '#/components/schemas/RoleEndpointMapping' },
            },
          },
        },
        RoleEndpointMapping: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            roleId: { type: 'string', format: 'uuid' },
            endpoint: { type: 'string', example: '/api/admin/settings' },
            method: { type: 'string', example: 'GET', enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', '*'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        UserWithRoles: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string', nullable: true },
            emailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            roles: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        SystemSetting: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            settingKey: { type: 'string', example: 'auth_email_password_enabled' },
            isEnabled: { type: 'boolean' },
            providerConfig: { type: 'object', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            action: { type: 'string' },
            userId: { type: 'string', nullable: true },
            details: { type: 'object', nullable: true },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  // Gather @swagger JSDoc comments from all route files
  apis: [
    path.join(__dirname, '../routes/*.ts'),
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../index.ts'),
    path.join(__dirname, '../index.js'),
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
