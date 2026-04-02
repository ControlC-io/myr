import { postJson } from "../../api/client";
import type { InterventionsParams, InterventionsPayload } from "./types";

const INTERVENTIONS_PROXY_PATH = (orgId: string) =>
  `/orgs/${orgId}/proxy/interventions`;

export async function fetchInterventions(
  params: InterventionsParams,
  jwtToken: string,
): Promise<InterventionsPayload> {
  const { orgId, dateBegin, paginPage, pageSize } = params;
  const body: Record<string, unknown> = {};
  if (dateBegin) body.dateBegin = dateBegin;
  if (paginPage) body.paginPage = paginPage;
  if (pageSize) body.pageSize = pageSize;
  return postJson<typeof body, InterventionsPayload>(
    INTERVENTIONS_PROXY_PATH(orgId),
    body,
    { Authorization: `Bearer ${jwtToken}` },
  );
}
