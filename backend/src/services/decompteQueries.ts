/**
 * Centralized GraphQL query builders for the Decompte external API.
 *
 * All knowledge of the external API's query structure lives here.
 * When the external API changes its field names, arguments, or nesting,
 * this is the only file that needs to be updated — all proxy routes
 * import from here and pick up the change automatically.
 *
 * Note: DECOMPTE_API_BASE must include the full endpoint path (e.g. http://host:port/graphql).
 * proxyService.ts uses it verbatim — do not append /graphql to the env var.
 *
 * Validation: each builder validates its inputs before interpolation to
 * prevent GraphQL injection via malformed externalReferenceId values.
 */

export interface TicketsQueryParams {
  supplierId: string;
  paginLimit: number;
  paginPage: number;
  orderByDesc: string;
}

/**
 * Validates that a supplier ID from externalReferenceId is a safe integer
 * before it is interpolated into a GraphQL query string.
 * Throws if the value is not a valid positive integer.
 */
export function validateSupplierId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id) || id <= 0 || String(id) !== raw.trim()) {
    throw Object.assign(
      new Error(`Invalid supplierId: "${raw}" is not a positive integer`),
      { statusCode: 403 }
    );
  }
  return id;
}

export function buildSupplierQuery(supplierId: string): string {
  const id = validateSupplierId(supplierId);
  return `{
    supplier(id: ${id}) {
      data {
        address
        address_comment
        country
        email
        fax
        id
        name
        num_tva
        phonenumber
        postcode
        raisonsociale
        town
        contacts {
          is_deleted
          contact { id firstname name email lang isRgroupPerson }
          roles { contactroles { name } }
        }
      }
    }
  }`;
}

export interface InterventionsQueryParams {
  supplierId: string;
  dateBegin: string;
}

/**
 * Builds a GraphQL query for upcoming interventions scoped to a client.
 * dateBegin must be in the form ">YYYY-MM-DD" (e.g. ">2026-03-18").
 */
export function buildInterventionsQuery(params: InterventionsQueryParams): string {
  const id = validateSupplierId(params.supplierId);
  const sanitized = params.dateBegin.replace(/[^><=\d-]/g, '');
  return `{ ticalIntervention(date_begin: "${sanitized}", ticket_client_id: ${id}) { total } }`;
}

/**
 * Builds a GraphQL query to fetch the full supplier context for a user:
 * company list, contact IDs, and roles. Used on every authenticated page load.
 * Email is sanitized to prevent GraphQL injection.
 */
export function buildContactSupplierDataQuery(email: string): string {
  const sanitized = email.replace(/[^a-zA-Z0-9.@+\-_]/g, '');
  if (!sanitized.includes('@')) {
    throw Object.assign(new Error('Invalid email address'), { statusCode: 400 });
  }
  return `query { contactSupplier(contactEmail: "${sanitized}", is_deleted: false) { data { contact { email id } supplier { id name raisonsociale } roles { contactroles { name } } } } }`;
}

/**
 * Builds a GraphQL query to check if an email is registered as a supplier contact.
 * Used during registration to verify the user exists in the external system.
 * Email is sanitized to prevent GraphQL injection.
 */
export function buildContactSupplierQuery(email: string): string {
  const sanitized = email.replace(/[^a-zA-Z0-9.@+\-_]/g, '');
  if (!sanitized.includes('@')) {
    throw Object.assign(new Error('Invalid email address'), { statusCode: 400 });
  }
  return `query { contactSupplier(contactEmail: "${sanitized}", is_deleted: false) { total } }`;
}

export function buildTicketsQuery(params: TicketsQueryParams): string {
  const id = validateSupplierId(params.supplierId);
  const limit = Math.max(1, Math.floor(params.paginLimit));
  const page = Math.max(1, Math.floor(params.paginPage));
  const order = params.orderByDesc.replace(/[^a-zA-Z_]/g, '');
  return `{
    ticket(
      suppliers_id_assign: ${id},
      paginLimit: ${limit},
      paginPage: ${page},
      orderByDesc: "${order}"
    ) {
      data {
        solvedate
        content
        date
        id
        name
        status
        intervention_date
        is_cyber_incident
        priority_v2
        tical_numero_prj
        ticketcategories { name }
        user_assign { realname firstname }
        group_assign { name }
        interventions {
          non_facturable
          desc_facturation
          preste
          date_begin
        }
        supplier { id }
      }
    }
  }`;
}
