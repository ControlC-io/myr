1. Backend and Security
Centralized Middleware: Implement authorization using Express middleware. Every database modification must check if the user is strictly authenticated. Do not handle authorization on a per endpoint basis; keep it centralized.

JWT Authentication: Rely on JWT validation rather than sessions. The backend must strictly validate the token and verify the identity of the user making the request.

API Documentation: Generate OpenAPI (Swagger) documentation for the backend services.

2. Frontend Separation and Testing
App Split: Separate the client side into two distinct applications: a Main Frontend App and an Admin App.

Counter Test Feature: In the Main Frontend, build a simple "Counter" that modifies the database.

Protected UI: The Counter must only work for properly authenticated users, proving that the centralized middleware is doing its job.

3. Role Based Access Control (RBAC)
Role Management: Create a system to manage roles within the Admin App.

Specific Roles: Define distinct roles such as "Admin User" and "Manager".

Endpoint Mapping: Provide a way in the admin configuration to define exactly which backend endpoints are accessible to which roles.

User Assignment: Allow admins to assign these roles to specific users via the Admin App interface.

4. Two Factor Authentication (2FA) and Infrastructure
Email 2FA: Implement a 2FA flow using email verification.

SendGrid Integration: Use SendGrid as the provider for sending these emails.

Dedicated Docker Service: Build this email sender as a small, dedicated microservice running in its own Docker Compose container.

Secret Management: Store all SendGrid keys and configuration strictly in the .env file. Ensure these secrets are never committed to Git.